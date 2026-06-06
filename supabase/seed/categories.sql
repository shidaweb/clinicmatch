insert into categories (slug, name, sort_order) values
  ('hair-removal', '脱毛', 1),
  ('pico-laser', 'ピコレーザー', 2),
  ('ipl', 'IPL・光治療', 3),
  ('hifu', 'HIFU', 4),
  ('rf', 'RF・高周波', 5),
  ('body', '痩身・ボディ', 6)
on conflict (slug) do nothing;
