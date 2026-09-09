-- Additive intake + CRM. No existing rows are deleted, rewritten, or backfilled.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS form_payload jsonb,
  ADD COLUMN IF NOT EXISTS submission_key uuid,
  ADD COLUMN IF NOT EXISTS submission_hash text,
  ADD COLUMN IF NOT EXISTS notification_status text,
  ADD COLUMN IF NOT EXISTS notification_attempted_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS consultations_submission_key_idx
  ON public.consultations(submission_key) WHERE submission_key IS NOT NULL;

CREATE TABLE public.crm_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid UNIQUE REFERENCES public.consultations(id),
  listing_id uuid UNIQUE REFERENCES public.listings(id),
  wanted_id uuid UNIQUE REFERENCES public.wanted_requests(id),
  approach_id uuid UNIQUE REFERENCES public.approaches(id),
  thread_id uuid UNIQUE REFERENCES public.threads(id),
  status text NOT NULL DEFAULT 'untriaged'
    CHECK (status IN ('untriaged','in_progress','waiting','on_hold','completed')),
  owner_id uuid REFERENCES public.profiles(id),
  next_action text,
  due_at timestamptz,
  last_contact_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(consultation_id,listing_id,wanted_id,approach_id,thread_id) = 1)
);
CREATE INDEX crm_cases_due_idx ON public.crm_cases(due_at) WHERE status <> 'completed';
CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.crm_cases(id),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  request_id uuid NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('note','phone','email','line','meeting','review')),
  contact_target text,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_activities_case_idx ON public.crm_activities(case_id,created_at);
ALTER TABLE public.crm_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_cases_admin_read ON public.crm_cases FOR SELECT TO authenticated USING(public.auth_is_admin());
CREATE POLICY crm_activities_admin_read ON public.crm_activities FOR SELECT TO authenticated USING(public.auth_is_admin());
REVOKE ALL ON public.crm_cases, public.crm_activities FROM anon, authenticated;
GRANT SELECT ON public.crm_cases, public.crm_activities TO authenticated;
GRANT ALL ON public.crm_cases, public.crm_activities TO service_role;

-- Registration is atomic and idempotent for the same Auth user. Never delete Auth users on failure.
CREATE FUNCTION public.register_member(p_user uuid, p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_org uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  SELECT org_id INTO v_org FROM public.profiles WHERE id = p_user;
  IF FOUND THEN RETURN v_org; END IF;
  INSERT INTO public.organizations(corporate_number,name,prefecture,city,contact_email,phone)
    VALUES(p_data->>'corporate_number',p_data->>'name',p_data->>'prefecture',p_data->>'city',p_data->>'email',nullif(p_data->>'phone',''))
    RETURNING id INTO v_org;
  INSERT INTO public.profiles(id,org_id,full_name,display_name,trade_side,role)
    VALUES(p_user,v_org,p_data->>'full_name',p_data->>'display_name',p_data->>'trade_side','member');
  RETURN v_org;
END $$;
REVOKE ALL ON FUNCTION public.register_member(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_member(uuid,jsonb) TO service_role;

-- A repeat submit returns only an ID, never somebody else's contact data.
CREATE FUNCTION public.receive_consultation(p_key uuid,p_hash text,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_row public.consultations;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text, 0));
  SELECT * INTO v_row FROM public.consultations WHERE submission_key=p_key;
  IF FOUND THEN
    IF v_row.submission_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'submission_conflict'; END IF;
    RETURN jsonb_build_object('id',v_row.id,'duplicate',true);
  END IF;
  INSERT INTO public.consultations(topic,contact_name,contact_email,contact_phone,org_id,
    related_listing_id,related_wanted_id,body,channel,source,form_payload,submission_key,submission_hash,notification_status)
  VALUES(p_data->>'topic',p_data->>'contact_name',p_data->>'contact_email',p_data->>'contact_phone',
    (p_data->>'org_id')::uuid,(p_data->>'related_listing_id')::uuid,(p_data->>'related_wanted_id')::uuid,
    p_data->>'body','form',p_data->>'source',p_data->'form_payload',p_key,p_hash,'pending') RETURNING * INTO v_row;
  RETURN jsonb_build_object('id',v_row.id,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.receive_consultation(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.receive_consultation(uuid,text,jsonb) TO service_role;

-- One transaction for the CRM state and its audit entry. The source row is untouched.
CREATE FUNCTION public.save_crm_case(p_source text,p_source_id uuid,p_actor uuid,p_version integer,p_request uuid,p_patch jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id uuid; v_case public.crm_cases; v_column text; v_activity_case uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_column := CASE p_source WHEN 'consultations' THEN 'consultation_id' WHEN 'listings' THEN 'listing_id'
    WHEN 'wanted_requests' THEN 'wanted_id' WHEN 'approaches' THEN 'approach_id' WHEN 'threads' THEN 'thread_id' END;
  IF v_column IS NULL THEN RAISE EXCEPTION 'invalid_source'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_source || p_source_id::text,0));
  EXECUTE format('SELECT * FROM public.crm_cases WHERE %I=$1 FOR UPDATE',v_column) INTO v_case USING p_source_id;
  SELECT case_id INTO v_activity_case FROM public.crm_activities WHERE request_id=p_request;
  IF FOUND THEN
    IF v_activity_case IS DISTINCT FROM v_case.id THEN RAISE EXCEPTION 'request_conflict'; END IF;
    RETURN v_activity_case;
  END IF;
  IF coalesce(v_case.version,0) <> p_version THEN RAISE EXCEPTION 'version_conflict'; END IF;
  IF (p_patch->>'owner_id') IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.profiles WHERE id=(p_patch->>'owner_id')::uuid AND role='admin'
  ) THEN RAISE EXCEPTION 'invalid_owner'; END IF;
  IF v_case.id IS NULL THEN
    EXECUTE format('INSERT INTO public.crm_cases(%I) VALUES($1) RETURNING id',v_column) INTO v_id USING p_source_id;
  ELSE v_id := v_case.id; END IF;
  UPDATE public.crm_cases SET status=p_patch->>'status',owner_id=(p_patch->>'owner_id')::uuid,
    next_action=nullif(p_patch->>'next_action',''),due_at=(p_patch->>'due_at')::timestamptz,
    last_contact_at=CASE WHEN p_patch->>'kind' IN ('phone','email','line','meeting')
      THEN greatest(last_contact_at,(p_patch->>'occurred_at')::timestamptz) ELSE last_contact_at END,
    version=coalesce(v_case.version,0)+1,updated_at=now() WHERE id=v_id;
  INSERT INTO public.crm_activities(case_id,actor_id,request_id,kind,contact_target,body,occurred_at)
  VALUES(v_id,p_actor,p_request,p_patch->>'kind',p_patch->>'contact_target',p_patch->>'body',(p_patch->>'occurred_at')::timestamptz);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.save_crm_case(text,uuid,uuid,integer,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_crm_case(text,uuid,uuid,integer,uuid,jsonb) TO service_role;
COMMIT;
