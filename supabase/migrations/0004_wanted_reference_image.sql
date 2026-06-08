-- Reference image for wanted requests (optional)

alter table wanted_requests
add column if not exists reference_image_path text;

insert into storage.buckets (id, name, public)
values ('wanted-images', 'wanted-images', true)
on conflict (id) do nothing;

drop policy if exists "wanted_images_public_read" on storage.objects;
create policy "wanted_images_public_read"
on storage.objects for select
using (bucket_id = 'wanted-images');

drop policy if exists "wanted_images_auth_upload" on storage.objects;
create policy "wanted_images_auth_upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'wanted-images'
  and (storage.foldername(name))[1] in (
    select w.id::text from wanted_requests w
    where w.buyer_org_id = auth_org_id()
  )
);

drop policy if exists "wanted_images_auth_delete" on storage.objects;
create policy "wanted_images_auth_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'wanted-images'
  and (storage.foldername(name))[1] in (
    select w.id::text from wanted_requests w
    where w.buyer_org_id = auth_org_id()
  )
);
