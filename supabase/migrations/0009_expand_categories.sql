-- カテゴリ拡張（2026-07 運営レビュー対応）
-- 既存6カテゴリに当てはまらない機器（QスイッチYAG機、CO2レーザー、
-- ピーリング・導入機、肌診断・測定機器、笑気鎮静器等）の受け皿を追加する。
-- 分類ルール: ピコレーザー＝ピコ秒発振機のみ。ナノ秒Qスイッチ機は yag へ。

insert into categories (slug, name, sort_order) values
  ('yag', 'YAG・Qスイッチレーザー', 3),
  ('co2', 'CO2レーザー', 4),
  ('facial-care', 'ピーリング・導入', 9),
  ('diagnostics', '診断・測定機器', 10),
  ('others', 'その他', 11)
on conflict (slug) do nothing;

-- 既存カテゴリの表示順を新体系に合わせて更新
update categories set sort_order = 1  where slug = 'hair-removal';
update categories set sort_order = 2  where slug = 'pico-laser';
update categories set sort_order = 5  where slug = 'ipl';
update categories set sort_order = 6  where slug = 'hifu';
update categories set sort_order = 7  where slug = 'rf';
update categories set sort_order = 8  where slug = 'body';
