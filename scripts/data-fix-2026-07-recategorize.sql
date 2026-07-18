-- =====================================================================
-- 出品データ修正スクリプト（2026-07 運営レビュー対応）
-- 実行前提: supabase/migrations/0009_expand_categories.sql 適用済みであること
-- 実行方法: 各STEPの SELECT で対象を確認 → 問題なければ UPDATE を実行
--           （Supabase SQL Editor での手動実行を想定。トランザクション推奨）
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- STEP 1: 「TAGショット」→「YAGショット」の誤記修正
-- GentleMax Pro はアレキサンドライト＋Nd:YAG の2波長機で、
-- ショットカウンタは AL / YAG の2系統。「TAG」はYAGの誤記。
-- ---------------------------------------------------------------------

-- 対象確認
select id, maker, model, status,
       description ilike '%TAGショット%' as in_description,
       maintenance_notes ilike '%TAGショット%' as in_maintenance_notes,
       condition_note ilike '%TAGショット%' as in_condition_note
from listings
where description ilike '%TAGショット%'
   or maintenance_notes ilike '%TAGショット%'
   or condition_note ilike '%TAGショット%';

-- 修正
update listings set description = replace(description, 'TAGショット', 'YAGショット')
where description ilike '%TAGショット%';
update listings set maintenance_notes = replace(maintenance_notes, 'TAGショット', 'YAGショット')
where maintenance_notes ilike '%TAGショット%';
update listings set condition_note = replace(condition_note, 'TAGショット', 'YAGショット')
where condition_note ilike '%TAGショット%';

-- ---------------------------------------------------------------------
-- STEP 2: 機種名ベースの再分類（調査済み・確定分）
-- 判定根拠: カテゴリ拡張・出品データ修正_Cursor指示書.md §1
-- 注意: 機種名の部分一致のため、必ず SELECT で対象を目視確認してから UPDATE すること
-- ---------------------------------------------------------------------

-- 対象確認（listings / wanted_requests 両方）
select 'listing' as kind, id, category_slug, maker, model, status from listings
where model ilike '%トライビーム%' or model ilike '%tri-beam%' or model ilike '%tribeam%'
   or model ilike '%アセット%' or model ilike '%asset%'
   or model ilike '%エッジワン%' or model ilike '%edge one%' or model ilike '%edgeone%'
   or model ilike '%CO2%' or model ilike '%炭酸ガス%'
   or model ilike '%ビジア%' or model ilike '%visia%'
   or model ilike '%メソナ%' or model ilike '%mesona%'
   or model ilike '%ハイドラフェイシャル%' or model ilike '%hydrafacial%' or model ilike '%シンデオ%' or model ilike '%syndeo%'
   or model ilike '%サイコリッチ%'
   or model ilike '%オリゴスキャン%' or model ilike '%oligoscan%'
   or model ilike '%ダームライト%' or model ilike '%dermlite%'
   or model ilike '%AGE%'
union all
select 'wanted', id, category_slug, maker, model, status from wanted_requests
where model ilike '%トライビーム%' or model ilike '%アセット%' or model ilike '%エッジワン%'
   or model ilike '%CO2%' or model ilike '%ビジア%' or model ilike '%メソナ%'
   or model ilike '%ハイドラフェイシャル%' or model ilike '%サイコリッチ%'
   or model ilike '%オリゴスキャン%' or model ilike '%ダームライト%';

-- YAG・Qスイッチレーザー
update listings set category_slug = 'yag'
where model ilike '%トライビーム%' or model ilike '%tri-beam%' or model ilike '%tribeam%'
   or model ilike '%アセット%';

-- CO2レーザー
update listings set category_slug = 'co2'
where model ilike '%エッジワン%' or model ilike '%edge one%' or model ilike '%edgeone%'
   or model ilike '%炭酸ガス%'
   or (model ilike '%CO2%' and model not ilike '%クール%');  -- CoolSculpting等の誤爆防止

-- ピーリング・導入
update listings set category_slug = 'facial-care'
where model ilike '%メソナ%' or model ilike '%mesona%'
   or model ilike '%ハイドラフェイシャル%' or model ilike '%hydrafacial%'
   or model ilike '%シンデオ%' or model ilike '%syndeo%';

-- 診断・測定機器
update listings set category_slug = 'diagnostics'
where model ilike '%ビジア%' or model ilike '%visia%'
   or model ilike '%オリゴスキャン%' or model ilike '%oligoscan%'
   or model ilike '%ダームライト%' or model ilike '%dermlite%';
-- 「AGE」は部分一致の誤爆リスクが高いため、STEP 2 の SELECT 結果を見て
-- 該当出品の id を確認し、個別に UPDATE すること:
-- update listings set category_slug = 'diagnostics' where id in ('<確認したid>');

-- その他（サイコリッチ＝笑気吸入鎮静器）
update listings set category_slug = 'others'
where model ilike '%サイコリッチ%';

-- ---------------------------------------------------------------------
-- STEP 3: 結果確認
-- ---------------------------------------------------------------------
select category_slug, count(*) from listings group by category_slug order by category_slug;

-- 問題なければ commit、想定外の変更があれば rollback
commit;
-- rollback;

-- ---------------------------------------------------------------------
-- 備考（手動対応・SQL化しない）:
-- ジェントルマックスプロ出品（希望価格 ¥4,700,000）の備考にある
-- YAG修理費用の二重記載（125万円税別 / 130万円税別＋保守77万円年）は、
-- 金額改定時の追記が残った可能性が高いが、データからは確定できない。
-- → 出品者に現行見積と保守内容を確認のうえ、備考を1本に統合すること。
-- ---------------------------------------------------------------------
