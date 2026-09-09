-- Preserve original image rows and storage objects. No storage deletes or data backfill.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.listing_images ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE TABLE public.post_media_receipts (
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  request_id uuid NOT NULL,
  source text NOT NULL CHECK(source IN ('listings','wanted_requests')),
  post_id uuid NOT NULL,
  payload jsonb NOT NULL,
  previous_value jsonb,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE public.post_media_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.post_media_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.post_media_receipts TO service_role;
REVOKE INSERT,UPDATE,DELETE ON public.listing_images FROM anon,authenticated;
-- Restrictive policies compose with ALL legacy permissive policies, including dashboard-created ones.
CREATE POLICY post_images_active ON public.listing_images AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(archived_at IS NULL);
CREATE POLICY post_media_server_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated
  WITH CHECK(bucket_id NOT IN ('listing-images','wanted-images'));
CREATE POLICY post_media_server_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
  USING(bucket_id NOT IN ('listing-images','wanted-images')) WITH CHECK(bucket_id NOT IN ('listing-images','wanted-images'));
CREATE POLICY post_media_server_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated
  USING(bucket_id NOT IN ('listing-images','wanted-images'));

CREATE FUNCTION public.guard_wanted_image() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF current_user IN ('postgres','service_role') THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.reference_image_path IS NOT NULL THEN RAISE EXCEPTION 'image_requires_server'; END IF;
  ELSIF NEW.reference_image_path IS DISTINCT FROM OLD.reference_image_path THEN RAISE EXCEPTION 'image_requires_server';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wanted_image_guard BEFORE INSERT OR UPDATE ON public.wanted_requests FOR EACH ROW EXECUTE FUNCTION public.guard_wanted_image();
REVOKE ALL ON FUNCTION public.guard_wanted_image() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.edit_post_media(p_source text,p_id uuid,p_actor uuid,p_key uuid,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_org uuid; v_post jsonb; v_old public.post_media_receipts; v_before jsonb; v_result jsonb;
  v_action text:=p_data->>'action'; v_path text:=p_data->>'path'; v_image uuid; v_count int; v_ids uuid[]; v_order uuid[]; v_cover uuid;
BEGIN
  IF p_source NOT IN ('listings','wanted_requests') OR p_key IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_input'; END IF;
  SELECT org_id INTO v_org FROM public.profiles WHERE id=p_actor;
  IF v_org IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text || p_key::text,1));
  EXECUTE format('SELECT to_jsonb(p) FROM public.%I p WHERE id=$1 FOR UPDATE',p_source) INTO v_post USING p_id;
  IF v_post IS NULL OR coalesce(v_post->>'seller_org_id',v_post->>'buyer_org_id')<>v_org::text THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_old FROM public.post_media_receipts WHERE actor_id=p_actor AND request_id=p_key;
  IF FOUND THEN
    IF v_old.source<>p_source OR v_old.post_id<>p_id OR v_old.payload<>p_data THEN RAISE EXCEPTION 'submission_conflict'; END IF;
    RETURN v_old.result || jsonb_build_object('duplicate',true);
  END IF;
  IF v_post->>'status' NOT IN ('draft','rejected') OR v_post->>'archived_at' IS NOT NULL THEN RAISE EXCEPTION 'post_not_editable'; END IF;
  IF v_action='attach' AND (v_path IS NULL OR v_path !~ ('^media-v2/' || p_id::text || '/[0-9a-f]{64}\.(jpg|png|webp)$')) THEN RAISE EXCEPTION 'invalid_path'; END IF;
  IF p_source='wanted_requests' THEN
    IF v_action<>'attach' THEN RAISE EXCEPTION 'invalid_action'; END IF;
    v_before := jsonb_build_object('reference_image_path',v_post->'reference_image_path');
    UPDATE public.wanted_requests SET reference_image_path=v_path WHERE id=p_id;
    v_result := jsonb_build_object('path',v_path);
  ELSE
    SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY sort_order,id),'[]') INTO v_before FROM public.listing_images i WHERE listing_id=p_id AND archived_at IS NULL;
    SELECT count(*),array_agg(id ORDER BY id) INTO v_count,v_ids FROM public.listing_images WHERE listing_id=p_id AND archived_at IS NULL;
    IF v_action='attach' THEN
      SELECT id INTO v_image FROM public.listing_images WHERE listing_id=p_id AND storage_path=v_path AND archived_at IS NULL LIMIT 1;
      IF v_image IS NULL THEN
        IF v_count>=10 THEN RAISE EXCEPTION 'image_limit'; END IF;
        INSERT INTO public.listing_images(listing_id,storage_path,sort_order,is_cover) VALUES(p_id,v_path,v_count,v_count=0) RETURNING id INTO v_image;
      END IF;
      SELECT jsonb_build_object('image',jsonb_build_object('id',id,'storage_path',storage_path,'is_cover',is_cover)) INTO v_result FROM public.listing_images WHERE id=v_image;
    ELSIF v_action IN ('archive','restore') THEN
      v_image := (p_data->>'image_id')::uuid;
      IF v_action='restore' AND v_count>=10 THEN RAISE EXCEPTION 'image_limit'; END IF;
      UPDATE public.listing_images SET archived_at=CASE WHEN v_action='archive' THEN now() END,is_cover=false,sort_order=v_count
        WHERE id=v_image AND listing_id=p_id AND ((v_action='archive' AND archived_at IS NULL) OR (v_action='restore' AND archived_at IS NOT NULL));
      IF NOT FOUND THEN RAISE EXCEPTION 'image_not_found'; END IF;
      WITH ranked AS (SELECT id,row_number() OVER(ORDER BY sort_order,id)-1 AS n FROM public.listing_images WHERE listing_id=p_id AND archived_at IS NULL)
        UPDATE public.listing_images i SET sort_order=r.n FROM ranked r WHERE i.id=r.id;
      IF NOT EXISTS(SELECT 1 FROM public.listing_images WHERE listing_id=p_id AND archived_at IS NULL AND is_cover) THEN
        UPDATE public.listing_images SET is_cover=true WHERE id=(SELECT id FROM public.listing_images WHERE listing_id=p_id AND archived_at IS NULL ORDER BY sort_order,id LIMIT 1);
      END IF;
      v_result := jsonb_build_object('id',v_image);
    ELSIF v_action='order' THEN
      IF p_data ? 'order' THEN
        SELECT array_agg(value::uuid ORDER BY ord) INTO v_order FROM jsonb_array_elements_text(p_data->'order') WITH ORDINALITY AS a(value,ord);
        IF cardinality(v_order) IS DISTINCT FROM v_count OR (SELECT array_agg(x ORDER BY x) FROM unnest(v_order) x) IS DISTINCT FROM v_ids THEN RAISE EXCEPTION 'image_set_conflict'; END IF;
        UPDATE public.listing_images SET sort_order=array_position(v_order,id)-1 WHERE listing_id=p_id AND archived_at IS NULL;
      END IF;
      IF p_data ? 'cover_id' THEN
        v_cover := (p_data->>'cover_id')::uuid;
        IF v_cover IS NULL OR NOT coalesce(v_cover=ANY(v_ids),false) THEN RAISE EXCEPTION 'image_not_found'; END IF;
        UPDATE public.listing_images SET is_cover=(id=v_cover) WHERE listing_id=p_id AND archived_at IS NULL;
      END IF;
      v_result := jsonb_build_object('id',p_id);
    ELSE RAISE EXCEPTION 'invalid_action';
    END IF;
  END IF;
  INSERT INTO public.post_media_receipts(actor_id,request_id,source,post_id,payload,previous_value,result)
    VALUES(p_actor,p_key,p_source,p_id,p_data,v_before,v_result);
  RETURN v_result || jsonb_build_object('duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.edit_post_media(text,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.edit_post_media(text,uuid,uuid,uuid,jsonb) TO service_role;
COMMIT;
