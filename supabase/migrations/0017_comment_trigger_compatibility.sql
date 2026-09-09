-- The existing trigger inherits callers' search_path. New locked-down RPCs use an empty path.
-- Qualify tables without changing counts or replacing the trigger itself.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE OR REPLACE FUNCTION public.sync_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.subject_type='listing' AND NEW.listing_id IS NOT NULL THEN
      UPDATE public.listings SET comment_count=comment_count+1 WHERE id=NEW.listing_id;
    ELSIF NEW.subject_type='wanted' AND NEW.wanted_request_id IS NOT NULL THEN
      UPDATE public.wanted_requests SET comment_count=comment_count+1 WHERE id=NEW.wanted_request_id;
    END IF;
  ELSIF TG_OP='DELETE' THEN
    IF OLD.subject_type='listing' AND OLD.listing_id IS NOT NULL THEN
      UPDATE public.listings SET comment_count=greatest(comment_count-1,0) WHERE id=OLD.listing_id;
    ELSIF OLD.subject_type='wanted' AND OLD.wanted_request_id IS NOT NULL THEN
      UPDATE public.wanted_requests SET comment_count=greatest(comment_count-1,0) WHERE id=OLD.wanted_request_id;
    END IF;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sync_comment_count() FROM PUBLIC,anon,authenticated;
COMMIT;
