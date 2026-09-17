# 法人・個人の会員登録対応

- Migration: `supabase/migrations/0018_member_identity.sql`。2026-09-18 JST、本番 `whhduhaihhvjkvyarasj` に適用。
- `organizations.account_type` を追加。既存7件は `corporate`。法人番号・名称・所在地などの既存列、および `profiles` 6件の全値を変更前後の照合で保持確認。
- 個人用の `invoice_registration_number` を追加。法人は13桁の法人番号、個人はT＋13桁のインボイス登録番号が必須。互いの不要な番号列はNULL。
- 番号は非公開。形式チェックは実在確認・本人確認とは異なる。`verified_at` は登録時に設定しない。
- 登録RPCの原子的な処理・再試行時の既存会員保持・service_roleのみ実行可能な権限を維持。一般会員の登録区分／番号書換えは禁止。
- DB先行デプロイ中は旧APIの法人登録も可能。アプリ側の新APIでは区分の明示的な選択を必須とする。
- 本番SQLはまずROLLBACKでリハーサルし、その後同じDDLをCOMMIT。トランザクション内で旧列のJSONをID順に集約したハッシュと会員全列を照合し、不一致なら例外で中断する形で実施。
- ローカルのAPIモック／PGliteで、法人・個人、不正な番号・組合せ、再開、原子的ロールバック、番号の秘匿と書換え禁止を検証。実ユーザーの作成や確認メール送信はテストで行っていない。
- ビルド・変更ファイルlint成功。全体Astro型チェックは変更外の既存16エラーを継続。
