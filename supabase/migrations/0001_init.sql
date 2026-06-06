-- ClinicMatch initial schema (see docs/spec.md)

-- Extensions
create extension if not exists "pgcrypto";

-- Categories
create table categories (
  slug text primary key,
  name text not null,
  sort_order int not null default 0
);

-- Organizations (clinic/legal entity)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  corporate_number varchar(13) not null,
  name text not null,
  prefecture text not null,
  city text not null,
  address_detail text,
  phone text,
  contact_email text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id),
  full_name text,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

-- Listings (sell)
create table listings (
  id uuid primary key default gen_random_uuid(),
  seller_org_id uuid not null references organizations(id),
  category_slug text not null references categories(slug),
  maker text not null,
  model text not null,
  manufacture_year int,
  manufacture_month int,
  condition text,
  shot_count int,
  has_accessories boolean default false,
  accessories_detail text,
  maker_maintenance text check (maker_maintenance in ('yes','no','unknown')) default 'unknown',
  maintenance_transferable text check (maintenance_transferable in ('yes','no','unknown')) default 'unknown',
  maintenance_notes text,
  asking_price int,
  location_prefecture text not null,
  location_city text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft','pending_review','published','reserved','closed')),
  view_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  is_cover boolean not null default false
);

-- Wanted requests (buy)
create table wanted_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_org_id uuid not null references organizations(id),
  buyer_user_id uuid not null references profiles(id),
  category_slug text not null references categories(slug),
  maker text,
  model text,
  condition_pref text,
  budget int,
  desired_timing text,
  area_prefecture text,
  area_city text,
  requirements text,
  status text not null default 'draft'
    check (status in ('draft','pending_review','published','reserved','closed')),
  view_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- Approaches
create table approaches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('interest','offer')),
  listing_id uuid references listings(id),
  wanted_request_id uuid references wanted_requests(id),
  from_org_id uuid not null references organizations(id),
  from_user_id uuid not null references profiles(id),
  budget int,
  price int,
  message text,
  status text not null default 'new'
    check (status in ('new','in_mediation','agreed','matched','declined')),
  created_at timestamptz not null default now(),
  check ((kind='interest' and listing_id is not null)
      or (kind='offer'    and wanted_request_id is not null))
);

-- Threads
create table threads (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('listing','wanted')),
  listing_id uuid references listings(id),
  wanted_request_id uuid references wanted_requests(id),
  approach_id uuid references approaches(id),
  buyer_org_id uuid not null references organizations(id),
  seller_org_id uuid not null references organizations(id),
  operator_id uuid references profiles(id),
  kind text not null default 'qa' check (kind in ('qa','mediation')),
  contact_disclosed boolean not null default false,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  sender_type text not null check (sender_type in ('buyer','seller','operator')),
  sender_user_id uuid references profiles(id),
  body text not null,
  attachment_path text,
  visible_to text not null default 'all' check (visible_to in ('all','buyer_side','seller_side')),
  created_at timestamptz not null default now()
);

-- Mediation agreements (seller ↔ operator, must precede deals)
create table mediation_agreements (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id),
  wanted_request_id uuid references wanted_requests(id),
  seller_org_id uuid not null references organizations(id),
  commission_rate numeric(4,3) not null default 0.075,
  terms text,
  status text not null default 'draft' check (status in ('draft','sent','signed','cancelled')),
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Deals (seller ↔ buyer)
create table deals (
  id uuid primary key default gen_random_uuid(),
  mediation_agreement_id uuid not null references mediation_agreements(id),
  buyer_org_id uuid not null references organizations(id),
  seller_org_id uuid not null references organizations(id),
  agreed_price int not null,
  commission_amount int,
  contract_template_key text,
  contract_doc_path text,
  contract_status text not null default 'preparing'
    check (contract_status in ('preparing','sent','signed')),
  status text not null default 'negotiating'
    check (status in ('negotiating','contracted','delivered','completed','cancelled')),
  concluded_at timestamptz,
  created_at timestamptz not null default now()
);

create table commission_invoices (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id),
  amount int not null,
  issued_at timestamptz not null default now(),
  due_date date,
  paid_at timestamptz,
  status text not null default 'issued' check (status in ('issued','paid','void'))
);

-- Consultations (anonymous OK)
create table consultations (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic in ('sell','buy','other')),
  contact_name text,
  contact_email text,
  contact_phone text,
  org_id uuid references organizations(id),
  related_listing_id uuid references listings(id),
  related_wanted_id uuid references wanted_requests(id),
  body text not null,
  channel text not null default 'form' check (channel in ('form','line')),
  status text not null default 'new' check (status in ('new','in_progress','closed')),
  created_at timestamptz not null default now()
);

-- Public view: only prefecture + city (no org name)
create or replace view public_orgs as
  select id, prefecture, city from organizations;

-- Indexes
create index idx_listings_status on listings(status);
create index idx_listings_category on listings(category_slug);
create index idx_wanted_status on wanted_requests(status);
create index idx_wanted_category on wanted_requests(category_slug);
create index idx_approaches_status on approaches(status);

-- Trigger: deals require signed mediation agreement
create or replace function check_mediation_agreement_signed()
returns trigger as $$
begin
  if not exists (
    select 1 from mediation_agreements
    where id = new.mediation_agreement_id and status = 'signed'
  ) then
    raise exception 'mediation_agreement must be signed before creating a deal';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_deals_require_signed_mediation
  before insert on deals
  for each row execute function check_mediation_agreement_signed();

-- Trigger: commission invoice on deal contracted
create or replace function issue_commission_invoice()
returns trigger as $$
declare
  rate numeric(4,3);
  amt int;
begin
  if new.status = 'contracted' and (old.status is distinct from 'contracted') then
    select ma.commission_rate into rate
    from mediation_agreements ma
    where ma.id = new.mediation_agreement_id;

    amt := round(new.agreed_price * coalesce(rate, 0.075));

    update deals set commission_amount = amt where id = new.id;

    insert into commission_invoices (deal_id, amount)
    values (new.id, amt);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_deal_contracted_invoice
  after update on deals
  for each row execute function issue_commission_invoice();

-- RLS
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table listings enable row level security;
alter table listing_images enable row level security;
alter table wanted_requests enable row level security;
alter table approaches enable row level security;
alter table threads enable row level security;
alter table messages enable row level security;
alter table mediation_agreements enable row level security;
alter table deals enable row level security;
alter table commission_invoices enable row level security;
alter table consultations enable row level security;

-- Helper: current user's org_id
create or replace function auth_org_id()
returns uuid as $$
  select org_id from profiles where id = auth.uid()
$$ language sql stable security definer;

-- Helper: is admin
create or replace function auth_is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  )
$$ language sql stable security definer;

-- Organizations policies
create policy org_select_own on organizations for select
  using (id = auth_org_id() or auth_is_admin());

create policy org_insert on organizations for insert
  with check (true);

create policy org_update_own on organizations for update
  using (id = auth_org_id() or auth_is_admin());

-- Profiles policies
create policy profiles_select on profiles for select
  using (id = auth.uid() or org_id = auth_org_id() or auth_is_admin());

create policy profiles_insert on profiles for insert
  with check (id = auth.uid());

create policy profiles_update on profiles for update
  using (id = auth.uid() or auth_is_admin());

-- Listings policies
create policy listings_public_read on listings for select
  using (status = 'published' or seller_org_id = auth_org_id() or auth_is_admin());

create policy listings_insert on listings for insert
  with check (seller_org_id = auth_org_id());

create policy listings_update on listings for update
  using (seller_org_id = auth_org_id() or auth_is_admin());

-- Listing images
create policy listing_images_read on listing_images for select
  using (
    exists (
      select 1 from listings l
      where l.id = listing_id
        and (l.status = 'published' or l.seller_org_id = auth_org_id() or auth_is_admin())
    )
  );

create policy listing_images_write on listing_images for all
  using (
    exists (
      select 1 from listings l
      where l.id = listing_id and l.seller_org_id = auth_org_id()
    )
  );

-- Wanted requests policies
create policy wanted_public_read on wanted_requests for select
  using (status = 'published' or buyer_org_id = auth_org_id() or auth_is_admin());

create policy wanted_insert on wanted_requests for insert
  with check (buyer_org_id = auth_org_id());

create policy wanted_update on wanted_requests for update
  using (buyer_org_id = auth_org_id() or auth_is_admin());

-- Approaches policies
create policy approaches_select on approaches for select
  using (
    from_org_id = auth_org_id()
    or auth_is_admin()
    or exists (
      select 1 from listings l
      where l.id = listing_id and l.seller_org_id = auth_org_id()
    )
    or exists (
      select 1 from wanted_requests w
      where w.id = wanted_request_id and w.buyer_org_id = auth_org_id()
    )
  );

create policy approaches_insert on approaches for insert
  with check (from_org_id = auth_org_id());

create policy approaches_update on approaches for update
  using (auth_is_admin() or from_org_id = auth_org_id());

-- Consultations: anyone can insert, admin reads
create policy consultations_insert on consultations for insert
  with check (true);

create policy consultations_admin on consultations for select
  using (auth_is_admin());

create policy consultations_admin_update on consultations for update
  using (auth_is_admin());

-- Admin-only for mediation/deals/invoices (Phase 2 prep)
create policy mediation_admin on mediation_agreements for all
  using (auth_is_admin() or seller_org_id = auth_org_id());

create policy deals_parties on deals for select
  using (buyer_org_id = auth_org_id() or seller_org_id = auth_org_id() or auth_is_admin());

create policy deals_admin_write on deals for all
  using (auth_is_admin());

create policy invoices_seller on commission_invoices for select
  using (
    auth_is_admin()
    or exists (
      select 1 from deals d
      where d.id = deal_id and d.seller_org_id = auth_org_id()
    )
  );

-- Storage bucket (run via Supabase dashboard or CLI)
-- insert into storage.buckets (id, name, public) values ('listing-images', 'listing-images', true);
