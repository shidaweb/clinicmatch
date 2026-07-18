insert into categories (slug, name, sort_order) values
  ('hair-removal', '脱毛', 1),
  ('pico-laser', 'ピコレーザー', 2),
  ('yag', 'YAG・Qスイッチレーザー', 3),
  ('co2', 'CO2レーザー', 4),
  ('ipl', 'IPL・光治療', 5),
  ('hifu', 'HIFU', 6),
  ('rf', 'RF・高周波', 7),
  ('body', '痩身・ボディ', 8),
  ('facial-care', 'ピーリング・導入', 9),
  ('diagnostics', '診断・測定機器', 10),
  ('others', 'その他', 11)
on conflict (slug) do nothing;
