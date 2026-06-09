-- 0005: comments foundation + profile extension + avatars

-- (A) profiles extension
alter table profiles
  add column if not exists display_name text,
  add column if not exists avatar_path text,
  add column if not exists trade_side text
    check (trade_side in ('sell', 'buy', 'both')) default 'both';

-- (B) comment_count cache on published entities
alter table listings
  add column if not exists comment_count int not null default 0;
alter table wanted_requests
  add column if not exists comment_count int not null default 0;

create or replace function sync_comment_count()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    if new.subject_type = 'listing' and new.listing_id is not null then
      update listings set comment_count = comment_count + 1 where id = new.listing_id;
    elsif new.subject_type = 'wanted' and new.wanted_request_id is not null then
      update wanted_requests set comment_count = comment_count + 1 where id = new.wanted_request_id;
    end if;
  elsif (tg_op = 'DELETE') then
    if old.subject_type = 'listing' and old.listing_id is not null then
      update listings set comment_count = greatest(comment_count - 1, 0) where id = old.listing_id;
    elsif old.subject_type = 'wanted' and old.wanted_request_id is not null then
      update wanted_requests set comment_count = greatest(comment_count - 1, 0) where id = old.wanted_request_id;
    end if;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_threads_comment_count on threads;
create trigger trg_threads_comment_count
  after insert or delete on threads
  for each row execute function sync_comment_count();

update listings l set comment_count = (
  select count(*) from threads t
  where t.subject_type = 'listing' and t.listing_id = l.id
);

update wanted_requests w set comment_count = (
  select count(*) from threads t
  where t.subject_type = 'wanted' and t.wanted_request_id = w.id
);

-- (C) threads insert policy for both buyer/seller on QA threads
drop policy if exists threads_insert on threads;
create policy threads_insert on threads for insert
  with check (
    auth_is_admin()
    or (
      kind = 'qa'
      and (buyer_org_id = auth_org_id() or seller_org_id = auth_org_id())
    )
  );

-- (D) avatars bucket and policies
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "avatars_auth_write" on storage.objects;
create policy "avatars_auth_write"
on storage.objects for all
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
