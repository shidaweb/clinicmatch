-- Phase 2: threads / messages RLS + Realtime

-- Threads: participants + admin
create policy threads_select on threads for select
  using (
    buyer_org_id = auth_org_id()
    or seller_org_id = auth_org_id()
    or auth_is_admin()
  );

create policy threads_insert on threads for insert
  with check (
    auth_is_admin()
    or (kind = 'qa' and buyer_org_id = auth_org_id())
  );

create policy threads_update on threads for update
  using (auth_is_admin());

-- Messages: visible_to filtering for non-admin participants
create policy messages_select on messages for select
  using (
    exists (
      select 1 from threads t
      where t.id = thread_id
        and (
          auth_is_admin()
          or (
            visible_to = 'all'
            and (t.buyer_org_id = auth_org_id() or t.seller_org_id = auth_org_id())
          )
          or (visible_to = 'buyer_side' and t.buyer_org_id = auth_org_id())
          or (visible_to = 'seller_side' and t.seller_org_id = auth_org_id())
        )
    )
  );

create policy messages_insert on messages for insert
  with check (
    exists (
      select 1 from threads t
      where t.id = thread_id
        and (
          auth_is_admin()
          or t.buyer_org_id = auth_org_id()
          or t.seller_org_id = auth_org_id()
        )
    )
  );

-- Enable Realtime for messages (Supabase Dashboard: Database > Replication でも可)
alter publication supabase_realtime add table messages;
