-- 削除復活バグの根本対応:
-- listings / wanted_requests には delete の RLS ポリシーが存在せず、
-- ユーザークライアントからの delete が「0行削除」のまま成功扱いになっていた
-- （マイページで下書き・審査中を削除しても一覧に復活して見える）。
-- API側は admin クライアント＋削除行数検証に変更済みだが、
-- DB 側にも本来あるべき delete ポリシーを追加しておく（多層防御）。
-- 公開中(published)の削除は引き続き不可（運営対応）。

drop policy if exists listings_delete_own on listings;
create policy listings_delete_own on listings for delete
  using (seller_org_id = auth_org_id() and status <> 'published');

drop policy if exists wanted_delete_own on wanted_requests;
create policy wanted_delete_own on wanted_requests for delete
  using (buyer_org_id = auth_org_id() and status <> 'published');
