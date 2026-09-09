BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.disclosure_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL UNIQUE REFERENCES public.threads(id),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  buyer_evidence text NOT NULL CHECK(length(trim(buyer_evidence)) BETWEEN 5 AND 2000),
  seller_evidence text NOT NULL CHECK(length(trim(seller_evidence)) BETWEEN 5 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.disclosure_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY disclosure_admin_read ON public.disclosure_events FOR SELECT TO authenticated USING(public.auth_is_admin());
REVOKE ALL ON public.disclosure_events FROM anon,authenticated;
GRANT SELECT ON public.disclosure_events TO authenticated;
GRANT ALL ON public.disclosure_events TO service_role;
CREATE FUNCTION public.disclose_mediation(p_thread uuid,p_actor uuid,p_buyer text,p_seller text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t public.threads;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO t FROM public.threads WHERE id=p_thread FOR UPDATE;
  IF NOT FOUND OR t.kind<>'mediation' OR t.status<>'open' THEN RAISE EXCEPTION 'invalid_thread'; END IF;
  IF t.contact_disclosed THEN RETURN jsonb_build_object('id',t.id,'duplicate',true); END IF;
  INSERT INTO public.disclosure_events(thread_id,actor_id,buyer_evidence,seller_evidence) VALUES(t.id,p_actor,p_buyer,p_seller);
  UPDATE public.threads SET contact_disclosed=true WHERE id=t.id;
  UPDATE public.approaches SET status='agreed' WHERE id=t.approach_id;
  INSERT INTO public.messages(thread_id,sender_type,sender_user_id,body,visible_to)
    VALUES(t.id,'operator',p_actor,'運営が双方の合意記録を確認し、連絡先を開示しました。','all');
  RETURN jsonb_build_object('id',t.id,'duplicate',false,'buyer_org_id',t.buyer_org_id,'seller_org_id',t.seller_org_id);
END $$;
REVOKE ALL ON FUNCTION public.disclose_mediation(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.disclose_mediation(uuid,uuid,text,text) TO service_role;
COMMIT;
