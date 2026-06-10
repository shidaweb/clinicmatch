-- allow rejected status for moderation flow

alter table listings drop constraint if exists listings_status_check;
alter table listings
  add constraint listings_status_check
  check (status in ('draft','pending_review','published','reserved','closed','rejected'));

alter table wanted_requests drop constraint if exists wanted_requests_status_check;
alter table wanted_requests
  add constraint wanted_requests_status_check
  check (status in ('draft','pending_review','published','reserved','closed','rejected'));
