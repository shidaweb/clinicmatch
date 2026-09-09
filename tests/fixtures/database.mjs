// Local PostgreSQL schema fixture, never a Supabase connection.
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const directory = new URL('../../supabase/migrations/', import.meta.url);
export async function migration(db, name) {
  let sql = await readFile(new URL(name, directory), 'utf8');
  // PGlite supplies gen_random_uuid. Realtime transport is outside this SQL test.
  sql = sql
    .replace('create extension if not exists "pgcrypto";', '')
    .replace('alter publication supabase_realtime add table messages;', '');
  await db.exec(sql);
}
export async function baselineDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
    grant usage on schema auth,public,storage to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for (const name of (await readdir(directory)).sort().filter((n) => /^00(0[1-9]|10)_/.test(n))) {
    // The live project seeded these categories manually before 0006.
    if (name.startsWith('0006'))
      await db.exec(
        "insert into categories(slug,name,sort_order) values ('rf','RF',0),('hifu','HIFU',0),('body','Body',0) on conflict do nothing"
      );
    await migration(db, name);
  }
  // These legacy permissive policies were observed in the live schema, beyond the repo migrations.
  await db.exec(`create policy listing_images_authenticated_upload on storage.objects for insert to authenticated with check(bucket_id='listing-images');
    create policy listing_images_owner_delete on storage.objects for delete to authenticated using(bucket_id='listing-images' and auth.uid()=owner);
    create policy listing_images_owner_update on storage.objects for update to authenticated using(bucket_id='listing-images' and auth.uid()=owner);
    grant all on all tables in schema public,storage to service_role;
    grant select,insert,update,delete on all tables in schema public,storage to authenticated;
    grant select on all tables in schema public,storage to anon;`);
  return db;
}
