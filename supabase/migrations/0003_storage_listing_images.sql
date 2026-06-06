-- Storage bucket + policies for listing images (idempotent)

insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

drop policy if exists "listing_images_public_read" on storage.objects;
create policy "listing_images_public_read"
on storage.objects for select
using (bucket_id = 'listing-images');

drop policy if exists "listing_images_auth_upload" on storage.objects;
create policy "listing_images_auth_upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] in (
    select l.id::text from listings l
    where l.seller_org_id = auth_org_id()
  )
);

drop policy if exists "listing_images_auth_delete" on storage.objects;
create policy "listing_images_auth_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] in (
    select l.id::text from listings l
    where l.seller_org_id = auth_org_id()
  )
);
