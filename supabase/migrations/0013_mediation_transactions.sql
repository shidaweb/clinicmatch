BEGIN;
SET LOCAL lock_timeout = '5s';
-- The prior raw API policies are permissive; server APIs own these operations now.
REVOKE INSERT ON public.consultations FROM anon,authenticated;
REVOKE DELETE ON public.listings,public.wanted_requests FROM anon,authenticated;
CREATE FUNCTION public.guard_workflow_write() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE t public.threads; owner uuid;
BEGIN
  IF current_user IN ('postgres','service_role') OR public.auth_is_admin() THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='mediation_agreements' OR TG_OP<>'INSERT' THEN RAISE EXCEPTION 'operator_required'; END IF;
  IF TG_TABLE_NAME='approaches' THEN
    IF NEW.from_user_id IS DISTINCT FROM auth.uid() OR NEW.from_org_id IS DISTINCT FROM public.auth_org_id() OR NEW.status<>'new' THEN RAISE EXCEPTION 'invalid_actor'; END IF;
    IF NEW.kind='interest' THEN
      SELECT seller_org_id INTO owner FROM public.listings WHERE id=NEW.listing_id AND status='published' AND archived_at IS NULL;
    ELSE
      SELECT buyer_org_id INTO owner FROM public.wanted_requests WHERE id=NEW.wanted_request_id AND status='published' AND archived_at IS NULL;
    END IF;
    IF owner IS NULL OR owner=NEW.from_org_id THEN RAISE EXCEPTION 'invalid_target'; END IF;
  ELSIF TG_TABLE_NAME='threads' THEN
    IF NEW.kind<>'qa' OR NEW.contact_disclosed OR NEW.operator_id IS NOT NULL OR NEW.status<>'open' OR NEW.approach_id IS NOT NULL THEN RAISE EXCEPTION 'operator_required'; END IF;
    IF NEW.subject_type='listing' THEN
      SELECT seller_org_id INTO owner FROM public.listings WHERE id=NEW.listing_id AND status='published';
      IF owner IS DISTINCT FROM NEW.seller_org_id THEN RAISE EXCEPTION 'invalid_target'; END IF;
    ELSE
      SELECT buyer_org_id INTO owner FROM public.wanted_requests WHERE id=NEW.wanted_request_id AND status='published';
      IF owner IS DISTINCT FROM NEW.buyer_org_id THEN RAISE EXCEPTION 'invalid_target'; END IF;
    END IF;
    IF public.auth_org_id() NOT IN (NEW.buyer_org_id,NEW.seller_org_id) THEN RAISE EXCEPTION 'invalid_actor'; END IF;
  ELSIF TG_TABLE_NAME='messages' THEN
    SELECT * INTO t FROM public.threads WHERE id=NEW.thread_id;
    IF t.id IS NULL OR t.status<>'open' OR NEW.sender_user_id IS DISTINCT FROM auth.uid() OR NEW.visible_to<>'all' THEN RAISE EXCEPTION 'invalid_message'; END IF;
    IF NEW.sender_type='buyer' AND t.buyer_org_id=public.auth_org_id() THEN RETURN NEW; END IF;
    IF NEW.sender_type='seller' AND t.seller_org_id=public.auth_org_id() THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'invalid_sender';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER approaches_guard BEFORE INSERT OR UPDATE OR DELETE ON public.approaches FOR EACH ROW EXECUTE FUNCTION public.guard_workflow_write();
CREATE TRIGGER threads_guard BEFORE INSERT OR UPDATE OR DELETE ON public.threads FOR EACH ROW EXECUTE FUNCTION public.guard_workflow_write();
CREATE TRIGGER messages_guard BEFORE INSERT OR UPDATE OR DELETE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.guard_workflow_write();
CREATE TRIGGER agreements_guard BEFORE INSERT OR UPDATE OR DELETE ON public.mediation_agreements FOR EACH ROW EXECUTE FUNCTION public.guard_workflow_write();
REVOKE ALL ON FUNCTION public.guard_workflow_write() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.start_mediation(p_approach uuid,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE a public.approaches; t uuid; buyer uuid; seller uuid; subject text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO a FROM public.approaches WHERE id=p_approach FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'approach_not_found'; END IF;
  SELECT id INTO t FROM public.threads WHERE approach_id=p_approach ORDER BY created_at,id LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('id',t,'duplicate',true); END IF;
  IF a.status<>'new' THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF a.kind='interest' THEN
    SELECT seller_org_id INTO seller FROM public.listings WHERE id=a.listing_id AND status='published' AND archived_at IS NULL FOR UPDATE;
    buyer:=a.from_org_id; subject:='listing';
  ELSE
    SELECT buyer_org_id INTO buyer FROM public.wanted_requests WHERE id=a.wanted_request_id AND status='published' AND archived_at IS NULL FOR UPDATE;
    seller:=a.from_org_id; subject:='wanted';
  END IF;
  IF seller IS NULL OR buyer IS NULL OR seller=buyer THEN RAISE EXCEPTION 'invalid_parties'; END IF;
  INSERT INTO public.threads(subject_type,listing_id,wanted_request_id,approach_id,buyer_org_id,seller_org_id,operator_id,kind,status)
    VALUES(subject,a.listing_id,a.wanted_request_id,a.id,buyer,seller,p_actor,'mediation','open') RETURNING id INTO t;
  UPDATE public.approaches SET status='in_mediation' WHERE id=a.id;
  INSERT INTO public.messages(thread_id,sender_type,sender_user_id,body,visible_to)
    VALUES(t,'operator',p_actor,'運営が仲介を開始しました。条件を確認しながら進めます。','all');
  -- The original approach remains in approaches.message; do not copy private text to a shared message.
  RETURN jsonb_build_object('id',t,'duplicate',false,'buyer_org_id',buyer,'seller_org_id',seller);
END $$;
REVOKE ALL ON FUNCTION public.start_mediation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_mediation(uuid,uuid) TO service_role;
COMMIT;
