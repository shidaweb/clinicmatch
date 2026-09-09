-- Preserve existing records; prevent client-side privilege/status escalation on future writes.
BEGIN;
SET LOCAL lock_timeout = '5s';
-- Qualify helper tables so callers with a locked search_path remain safe.
CREATE OR REPLACE FUNCTION public.auth_org_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$SELECT org_id FROM public.profiles WHERE id=auth.uid()$$;
CREATE OR REPLACE FUNCTION public.auth_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin')$$;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.wanted_requests ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.profiles(id);
CREATE TABLE public.post_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id),
  wanted_id uuid REFERENCES public.wanted_requests(id),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  decision text NOT NULL CHECK(decision IN ('published','rejected')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(num_nonnulls(listing_id,wanted_id)=1)
);
ALTER TABLE public.post_review_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY post_reviews_read ON public.post_review_events FOR SELECT TO authenticated USING(
  public.auth_is_admin() OR EXISTS(SELECT 1 FROM public.listings l WHERE l.id=listing_id AND l.seller_org_id=public.auth_org_id())
  OR EXISTS(SELECT 1 FROM public.wanted_requests w WHERE w.id=wanted_id AND w.buyer_org_id=public.auth_org_id())
);
REVOKE ALL ON public.post_review_events FROM anon,authenticated;
GRANT SELECT ON public.post_review_events TO authenticated;
GRANT ALL ON public.post_review_events TO service_role;

CREATE FUNCTION public.guard_member_write() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user IN ('postgres','service_role') OR public.auth_is_admin() THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='profiles' THEN
    IF TG_OP='INSERT' THEN RAISE EXCEPTION 'profile_creation_requires_server'; END IF;
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'profile_identity_is_immutable';
    END IF;
  ELSIF TG_TABLE_NAME='organizations' THEN
    IF TG_OP='INSERT' THEN RAISE EXCEPTION 'organization_creation_requires_server'; END IF;
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.verified_at IS DISTINCT FROM OLD.verified_at OR NEW.corporate_number IS DISTINCT FROM OLD.corporate_number THEN
      RAISE EXCEPTION 'organization_verification_requires_admin';
    END IF;
  ELSIF TG_TABLE_NAME IN ('listings','wanted_requests') THEN
    IF TG_OP='INSERT' THEN
      IF NEW.status NOT IN ('draft','pending_review') OR NEW.published_at IS NOT NULL THEN RAISE EXCEPTION 'review_required'; END IF;
      IF TG_TABLE_NAME='listings' THEN
        IF NEW.submitted_by IS NOT NULL AND NEW.submitted_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'invalid_author'; END IF;
        NEW.submitted_by := auth.uid();
      ELSE
        IF NEW.buyer_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'invalid_author'; END IF;
      END IF;
    END IF;
    IF TG_OP='UPDATE' THEN
      IF OLD.status NOT IN ('draft','rejected') OR NEW.status NOT IN ('draft','pending_review','rejected') THEN RAISE EXCEPTION 'post_not_editable'; END IF;
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN RAISE EXCEPTION 'review_required'; END IF;
      IF TG_TABLE_NAME='listings' THEN
        IF NEW.seller_org_id IS DISTINCT FROM OLD.seller_org_id OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by THEN RAISE EXCEPTION 'owner_is_immutable'; END IF;
      END IF;
      IF TG_TABLE_NAME='wanted_requests' THEN
        IF NEW.buyer_org_id IS DISTINCT FROM OLD.buyer_org_id OR NEW.buyer_user_id IS DISTINCT FROM OLD.buyer_user_id THEN RAISE EXCEPTION 'owner_is_immutable'; END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_guard BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_member_write();
CREATE TRIGGER organizations_guard BEFORE INSERT OR UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.guard_member_write();
CREATE TRIGGER listings_guard BEFORE INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.guard_member_write();
CREATE TRIGGER wanted_guard BEFORE INSERT OR UPDATE ON public.wanted_requests FOR EACH ROW EXECUTE FUNCTION public.guard_member_write();
REVOKE ALL ON FUNCTION public.guard_member_write() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.review_post(p_source text,p_id uuid,p_actor uuid,p_decision text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_row jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_source NOT IN ('listings','wanted_requests') OR p_decision NOT IN ('published','rejected') THEN RAISE EXCEPTION 'invalid_review'; END IF;
  IF p_decision='rejected' AND length(trim(coalesce(p_reason,'')))=0 THEN RAISE EXCEPTION 'reason_required'; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 FOR UPDATE',p_source) INTO v_row USING p_id;
  IF v_row IS NULL OR v_row->>'status'<>'pending_review' OR v_row->>'archived_at' IS NOT NULL THEN RAISE EXCEPTION 'not_pending_review'; END IF;
  EXECUTE format('UPDATE public.%I SET status=$1,published_at=$2 WHERE id=$3',p_source)
    USING p_decision,CASE WHEN p_decision='published' THEN now() ELSE null::timestamptz END,p_id;
  INSERT INTO public.post_review_events(listing_id,wanted_id,actor_id,decision,reason)
    VALUES(CASE WHEN p_source='listings' THEN p_id END,CASE WHEN p_source='wanted_requests' THEN p_id END,p_actor,p_decision,p_reason);
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.review_post(text,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_post(text,uuid,uuid,text,text) TO service_role;
COMMIT;
