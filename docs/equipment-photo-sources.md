# 機器写真の使い方と出典

2026-09-18。利用者から提供された写真を使用。公開用の軽量画像は `public/images/equipment/` に保存。

## 使用箇所

- トップ・共通相談枠：生成した機器コラージュ。「機器のイメージ」と表示。
- トップ・対応カテゴリ：提供写真を使った機器ギャラリー。
- 出品一覧・詳細：実物写真が未登録で、メーカーと機種の対応を確認できる場合のみ参考写真を表示。「出品個体の写真ではありません」と明記。出品者の写真が優先。DBの写真データは変更しない。
- 売却相談：ハンドピース・付属品の撮影例。

## 原素材

|公開ファイル名の接頭辞|機器・素材|提供元|
|---|---|---|
|gentlemax-pro|Candela GentleMax Pro / 1769692968791.jpg|[GP](https://drive.google.com/drive/folders/14zdjHm9WIJ2fnrbxBEnOIMLVIoMzS0j1)|
|mediostar-monolith|Asclepion MeDioStar Monolith / 1769692866865.jpg（側面）|[MS](https://drive.google.com/drive/folders/1uZ_czc7_Yr3csfpLweWwkQMaI4_MOqTK)|
|xeo|CUTERA xeo / LINE_ALBUM_XEO_250209_4.jpg|[xeo](https://drive.google.com/drive/folders/1I-9HbL0Wye_OWR19N6SYT32ty7A6FDpb)|
|ulthera|Ulthera / Merz ウルセラ / ウルセラ.jpg|[ウルセラ](https://drive.google.com/drive/folders/1ozm7gd1fw0evQZwOs7QE4A-40U1HZoHe)|
|picoway|Candela PicoWay / S__17891425_0.jpg|[ピコウェイ](https://drive.google.com/drive/folders/1OxVnvCZ5anMXFEseMLIBVqOp3vtcYZxH)|
|ulthera-handpiece|③ウルセラ　ハンドピース.png|利用者添付|
|gentlemax-accessories|ジェントルマックスプロ.pdf 内の付属品集合写真|利用者添付|
|xeo-accessories|②ゼオ　附属品.pdf 内のゴーグル・ケース写真|利用者添付|

実写はWebP変換・リサイズのみ。MS正面写真は個人名・連絡先の写り込みがあるため不使用。PDF全体は公開しない。

## コラージュ

組み込み imagegen で生成。参照画像は「③ウルセラ.png」、GPの実写、「③ウルセラ　ハンドピース.png」。生成画像はブランド用のイメージに限り、出品個体の写真には使用しない。

公開画像：`public/images/equipment/collage-1440.webp`、`collage-768.webp`。
生成原本：`/Users/norimitsushida/.codex/generated_images/01a0b19f-57a8-79a1-9b59-ab7da84afcb7/exec-a62df3fc-faa4-4cf4-96a9-ac6d543b9b24.png`

生成プロンプト：

> Use case: compositing. Create one landscape editorial collage image for Clinicmatch, a Japanese used aesthetic medical equipment marketplace. Input 1 Ulthera full console, input 2 genuine Candela GentleMax Pro machine photo, input 3 Ulthera handpiece: supporting compositing inputs. Precisely cut out the supplied devices from their backgrounds and compose them on a warm ivory (#f8f4f0) studio background, subtle dusty rose flat plane and soft natural grounding shadows. Ulthera console on right at full height, GentleMax Pro console on left shown only as much as exists in the source (never invent hidden lower wheels), handpiece smaller foreground at lower center. Devices together occupy 75 percent of canvas with generous margins and natural overlap, restrained Japanese editorial catalogue aesthetic. Preserve machine silhouettes, physical controls, screen content layout, colors and branding; do not redesign equipment, add accessories or invent functionality. No people. No slogans, captions, decorative English, badges, borders or watermark. Do not portray a real sale or listing, this is an illustrative brand collage of sample equipment. Wide 3:2 composition, high quality.

## 追加・差し替え

対応は `src/lib/equipment-images.ts` で管理。メーカーが不明な機器、異なる派生モデル、消耗品には本体写真を自動適用しない。対応変更時は `tests/unit/equipment-images.cjs` を更新し、`npm run test:workflow` を実行する。
