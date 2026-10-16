-- Let sellers revise price and terms on a published listing without re-review.
-- Category, maker, model, consumable fields, images and status stay locked once published.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE OR REPLACE FUNCTION public.guard_member_write() RETURNS trigger
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
    IF TG_OP='UPDATE' AND TG_TABLE_NAME='listings' AND OLD.status='published' THEN
      -- Sellers may revise terms on a live listing; identity and review fields stay locked.
      IF NEW.status IS DISTINCT FROM OLD.status OR NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
        RAISE EXCEPTION 'post_not_editable';
      END IF;
      IF (to_jsonb(NEW) - ARRAY['asking_price','negotiable','quantity','description','condition','condition_note',
            'has_accessories','accessories_detail','maker_maintenance','maintenance_transferable','maintenance_notes',
            'location_prefecture','location_city'])
         IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['asking_price','negotiable','quantity','description','condition','condition_note',
            'has_accessories','accessories_detail','maker_maintenance','maintenance_transferable','maintenance_notes',
            'location_prefecture','location_city']) THEN
        RAISE EXCEPTION 'published_field_locked';
      END IF;
      RETURN NEW;
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
REVOKE ALL ON FUNCTION public.guard_member_write() FROM PUBLIC,anon,authenticated;
COMMIT;
