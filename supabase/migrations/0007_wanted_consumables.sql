-- Wanted requests: consumables search preferences

alter table wanted_requests
  add column if not exists listing_kind_pref text not null default 'device'
    check (listing_kind_pref in ('device','consumable_valid','consumable_expired')),
  add column if not exists consumable_master_id uuid references consumable_master(id),
  add column if not exists only_unexpired boolean not null default false,
  add column if not exists min_remaining_shots int check (min_remaining_shots >= 0),
  add column if not exists open_state_pref text
    check (open_state_pref in ('sealed_only','opened_allowed','used_allowed'));
