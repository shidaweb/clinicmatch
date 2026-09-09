-- New post receipts only. Existing posts are neither rewritten nor merged.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE public.post_creation_receipts (
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  request_id uuid NOT NULL,
  source text NOT NULL CHECK(source IN ('listings','wanted_requests')),
  payload jsonb NOT NULL,
  listing_id uuid REFERENCES public.listings(id),
  wanted_id uuid REFERENCES public.wanted_requests(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_id,request_id),
  CHECK(num_nonnulls(listing_id,wanted_id)=1)
);
ALTER TABLE public.post_creation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.post_creation_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.post_creation_receipts TO service_role;

CREATE FUNCTION public.create_post_once(p_source text,p_actor uuid,p_key uuid,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_org uuid; v_old public.post_creation_receipts; v_allowed text[]; v_payload jsonb; v_columns text; v_id uuid;
BEGIN
  IF p_source NOT IN ('listings','wanted_requests') OR p_key IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_input'; END IF;
  SELECT org_id INTO v_org FROM public.profiles WHERE id=p_actor;
  IF v_org IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text || p_key::text, 0));
  SELECT * INTO v_old FROM public.post_creation_receipts WHERE actor_id=p_actor AND request_id=p_key;
  IF FOUND THEN
    IF v_old.source<>p_source OR v_old.payload<>p_data THEN RAISE EXCEPTION 'submission_conflict'; END IF;
    RETURN jsonb_build_object('id',coalesce(v_old.listing_id,v_old.wanted_id),'duplicate',true);
  END IF;
  IF coalesce(p_data->>'status','draft') NOT IN ('draft','pending_review') THEN RAISE EXCEPTION 'review_required'; END IF;
  IF p_source='listings' THEN
    v_allowed := ARRAY['category_slug','maker','model','manufacture_year','manufacture_month','condition','shot_count','asking_price','location_prefecture','location_city','has_accessories','accessories_detail','maker_maintenance','maintenance_transferable','maintenance_notes','description','listing_kind','quantity','open_state','expiry_date','remaining_shots','remaining_life','lot_number','condition_note','negotiable','reuse_attestation','status','consumable_master_id','clinical_use','shipping_flags','compliance_note'];
  ELSE
    v_allowed := ARRAY['category_slug','maker','model','condition_pref','budget','desired_timing','area_prefecture','area_city','requirements','listing_kind_pref','consumable_master_id','only_unexpired','min_remaining_shots','open_state_pref','status'];
  END IF;
  SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO v_payload FROM jsonb_each(p_data) WHERE key=ANY(v_allowed);
  IF p_source='listings' THEN
    v_payload := v_payload || jsonb_build_object('seller_org_id',v_org,'submitted_by',p_actor);
  ELSE
    v_payload := v_payload || jsonb_build_object('buyer_org_id',v_org,'buyer_user_id',p_actor);
  END IF;
  SELECT string_agg(format('%I',key),',' ORDER BY key) INTO v_columns FROM jsonb_object_keys(v_payload) AS k(key);
  EXECUTE format('INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_record(NULL::public.%1$I,$1) RETURNING id',p_source,v_columns) INTO v_id USING v_payload;
  INSERT INTO public.post_creation_receipts(actor_id,request_id,source,payload,listing_id,wanted_id)
    VALUES(p_actor,p_key,p_source,p_data,CASE WHEN p_source='listings' THEN v_id END,CASE WHEN p_source='wanted_requests' THEN v_id END);
  RETURN jsonb_build_object('id',v_id,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.create_post_once(text,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_post_once(text,uuid,uuid,jsonb) TO service_role;
COMMIT;
