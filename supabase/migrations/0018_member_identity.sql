-- Expand registration to corporations and invoice-registered individuals.
-- Existing organization IDs, memberships, and original column values are retained.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.organizations
  ADD COLUMN account_type text NOT NULL DEFAULT 'corporate'
    CHECK (account_type IN ('corporate', 'individual')),
  ADD COLUMN invoice_registration_number varchar(14),
  ALTER COLUMN corporate_number DROP NOT NULL;

ALTER TABLE public.organizations ADD CONSTRAINT organizations_identity_check CHECK (
  (account_type = 'corporate' AND corporate_number IS NOT NULL
    AND corporate_number ~ '^[0-9]{13}$' AND invoice_registration_number IS NULL)
  OR
  (account_type = 'individual' AND corporate_number IS NULL
    AND invoice_registration_number IS NOT NULL AND invoice_registration_number ~ '^T[0-9]{13}$')
);
COMMENT ON COLUMN public.organizations.account_type IS 'Registration identity; legacy members remain corporate.';
COMMENT ON COLUMN public.organizations.invoice_registration_number IS 'Private invoice registration number. Never a personal My Number. Format validation is not verification.';

-- Preserve the existing idempotent, server-only registration contract.
-- Default supports the previous API during a database-first rolling deployment.
CREATE OR REPLACE FUNCTION public.register_member(p_user uuid, p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_org uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  SELECT org_id INTO v_org FROM public.profiles WHERE id = p_user;
  IF FOUND THEN RETURN v_org; END IF;
  INSERT INTO public.organizations(account_type,corporate_number,invoice_registration_number,name,prefecture,city,contact_email,phone)
    VALUES(coalesce(p_data->>'account_type','corporate'),nullif(p_data->>'corporate_number',''),
      nullif(p_data->>'invoice_registration_number',''),p_data->>'name',p_data->>'prefecture',p_data->>'city',
      p_data->>'email',nullif(p_data->>'phone',''))
    RETURNING id INTO v_org;
  INSERT INTO public.profiles(id,org_id,full_name,display_name,trade_side,role)
    VALUES(p_user,v_org,p_data->>'full_name',p_data->>'display_name',p_data->>'trade_side','member');
  RETURN v_org;
END $$;
REVOKE ALL ON FUNCTION public.register_member(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_member(uuid,jsonb) TO service_role;

-- Extend identity immutability without changing the existing member/status guards.
CREATE FUNCTION public.guard_member_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user IN ('postgres','service_role') OR public.auth_is_admin() THEN RETURN NEW; END IF;
  IF NEW.account_type IS DISTINCT FROM OLD.account_type
    OR NEW.invoice_registration_number IS DISTINCT FROM OLD.invoice_registration_number THEN
    RAISE EXCEPTION 'organization_verification_requires_admin';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER organizations_identity_guard BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_member_identity();
REVOKE ALL ON FUNCTION public.guard_member_identity() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
