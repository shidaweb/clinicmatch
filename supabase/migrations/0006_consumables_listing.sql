-- Consumables listing support (master-driven)

create table if not exists consumable_master (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null references categories(slug),
  maker text not null,
  model text not null,
  name text not null,
  item_type text not null check (
    item_type in ('non_contact_part', 'life_part', 'expiry_material', 'shot_controlled_single_use', 'sterile_single_use_invasive')
  ),
  contact_level text not null check (contact_level in ('non_contact', 'contact_non_invasive', 'invasive')),
  is_sterile_sud boolean not null default false,
  is_shot_controlled boolean not null default false,
  has_expiry boolean not null default false,
  prohibit_reuse boolean not null default false,
  shipping_flags text[] not null default '{}',
  requires_manual_review boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_consumable_master_category on consumable_master(category_slug);
create index if not exists idx_consumable_master_active on consumable_master(is_active);
create index if not exists idx_consumable_master_maker_model on consumable_master(maker, model);

alter table listings
  add column if not exists listing_kind text not null default 'device'
    check (listing_kind in ('device','consumable_valid','consumable_expired')),
  add column if not exists consumable_master_id uuid references consumable_master(id),
  add column if not exists quantity int not null default 1 check (quantity > 0),
  add column if not exists open_state text check (open_state in ('sealed','opened','used')),
  add column if not exists expiry_date date,
  add column if not exists remaining_shots int check (remaining_shots >= 0),
  add column if not exists remaining_life text,
  add column if not exists lot_number text,
  add column if not exists clinical_use text not null default 'patient_ok'
    check (clinical_use in ('patient_ok','training_only')),
  add column if not exists condition_note text,
  add column if not exists negotiable boolean not null default false,
  add column if not exists reuse_attestation boolean,
  add column if not exists shipping_flags text[] not null default '{}',
  add column if not exists compliance_note text;

alter table consumable_master enable row level security;

drop policy if exists consumable_master_read on consumable_master;
create policy consumable_master_read on consumable_master for select
  using (is_active = true or auth_is_admin());

drop policy if exists consumable_master_admin_write on consumable_master;
create policy consumable_master_admin_write on consumable_master for all
  using (auth_is_admin())
  with check (auth_is_admin());

insert into consumable_master (
  category_slug,
  maker,
  model,
  name,
  item_type,
  contact_level,
  is_sterile_sud,
  is_shot_controlled,
  has_expiry,
  prohibit_reuse,
  shipping_flags,
  requires_manual_review
) values
  ('rf', 'Solta Medical', 'Thermage FLX', 'トータルチップ600', 'shot_controlled_single_use', 'contact_non_invasive', false, true, true, true, '{}', true),
  ('hifu', 'Merz', 'Ulthera', 'MF4.5カートリッジ', 'shot_controlled_single_use', 'contact_non_invasive', false, true, true, false, '{}', false),
  ('rf', 'INMODE', 'Morpheus8', 'RFニードル（滅菌単回）', 'sterile_single_use_invasive', 'invasive', true, false, true, true, '{}', true),
  ('body', 'CoolSculpting', 'CoolSculpting Elite', '冷却ジェルパッド', 'expiry_material', 'contact_non_invasive', false, false, true, false, '{high_pressure_gas}', true)
on conflict do nothing;
