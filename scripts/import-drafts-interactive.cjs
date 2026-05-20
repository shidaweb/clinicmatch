#!/usr/bin/env node
/**
 * Interactive Sanity blog draft importer.
 *
 *   npm run sanity:import
 *
 * Prompts for API token, lists drafts, dry-runs, then applies on confirmation.
 */
const fs = require('fs');
const path = require('path');
const {
  loadWriteToken,
  createSanityClient,
  loadDraftFile,
  PROJECT_ID,
  DATASET,
} = require('./lib/sanity-import-utils.cjs');
const { ask, askYesNo, askSecret } = require('./lib/prompt.cjs');
const { listDraftFiles, importOne, DRAFTS_DIR } = require('./import-drafts.cjs');

const ENV_FILE = path.resolve(process.cwd(), '.env.clinicmatch');

async function validateToken(token) {
  const client = createSanityClient(token);
  const count = await client.fetch('count(*[_type == "post"])');
  return count;
}

function saveTokenToEnvFile(token) {
  const line = `SANITY_WRITE_TOKEN=${token}`;
  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    if (/SANITY_WRITE_TOKEN\s*=/.test(content)) {
      fs.writeFileSync(
        ENV_FILE,
        content.replace(/SANITY_WRITE_TOKEN\s*=\s*.+/, line) + (content.endsWith('\n') ? '' : '\n')
      );
    } else {
      fs.appendFileSync(ENV_FILE, `\n${line}\n`);
    }
  } else {
    fs.writeFileSync(
      ENV_FILE,
      `# Sanity write token (gitignored via .env)\nSANITY_PROJECT_ID=${PROJECT_ID}\nSANITY_DATASET=${DATASET}\n${line}\n`
    );
  }
  console.log(`\n保存しました: ${ENV_FILE}`);
  console.log('（.env は .gitignore 対象です。コミットしないでください）');
}

async function resolveToken() {
  const fromEnv = loadWriteToken();
  if (fromEnv) {
    const useEnv = await askYesNo(
      `.env / 環境変数にトークンがあります。これを使いますか`,
      true
    );
    if (useEnv) return fromEnv;
  }

  console.log('\nSanity API トークンを入力してください（Editor 以上の権限）。');
  console.log('発行: https://www.sanity.io/manage → プロジェクト → API → Tokens\n');

  let token = await askSecret('SANITY_WRITE_TOKEN');
  if (!token) {
    console.error('トークンが空です。終了します。');
    process.exit(1);
  }

  process.stdout.write('接続確認中... ');
  try {
    const count = await validateToken(token);
    console.log(`OK（既存 post: ${count} 件）\n`);
  } catch (err) {
    console.log('失敗');
    console.error(`トークンまたは権限を確認してください: ${err.message}`);
    process.exit(1);
  }

  const save = await askYesNo(`${path.basename(ENV_FILE)} にトークンを保存しますか`, true);
  if (save) saveTokenToEnvFile(token);

  return token;
}

function printDraftMenu(files) {
  console.log('ドラフト一覧:\n');
  files.forEach((file, i) => {
    try {
      const { meta } = loadDraftFile(path.join(DRAFTS_DIR, file));
      const mode = meta.mode || 'create';
      console.log(
        `  ${i + 1}. ${file}\n     ${mode.padEnd(7)} slug: ${meta.slug}\n     ${meta.title.slice(0, 60)}${meta.title.length > 60 ? '…' : ''}`
      );
    } catch (e) {
      console.log(`  ${i + 1}. ${file}  (読み込みエラー: ${e.message})`);
    }
  });
  console.log('');
}

function parseSelection(input, files) {
  const raw = input.trim().toLowerCase();
  if (raw === '' || raw === 'a' || raw === 'all') return [...files];
  if (raw === 'q' || raw === 'quit' || raw === 'exit') return null;

  const selected = new Set();
  for (const part of raw.split(/[,\s]+/)) {
    const n = parseInt(part, 10);
    if (Number.isFinite(n) && n >= 1 && n <= files.length) {
      selected.add(files[n - 1]);
    } else if (files.includes(part)) {
      selected.add(part);
    } else if (part.endsWith('.md') && files.some((f) => f.includes(part))) {
      const match = files.find((f) => f === part || f.endsWith(part));
      if (match) selected.add(match);
    }
  }

  return selected.size ? files.filter((f) => selected.has(f)) : null;
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Clinicmatch — Sanity ブログドラフト投入');
  console.log(`  project: ${PROJECT_ID}  dataset: ${DATASET}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const token = await resolveToken();
  const client = createSanityClient(token);
  const files = listDraftFiles();

  if (files.length === 0) {
    console.error('drafts/ に 01-*.md がありません。');
    process.exit(1);
  }

  printDraftMenu(files);

  console.log('反映する記事を選んでください:');
  console.log('  番号 … 1 または 1,3,5');
  console.log('  ファイル名 … 03-installation-guide-rewrite.md');
  console.log('  all / Enter … 全件');
  console.log('  q … 終了\n');

  const selectionInput = await ask('選択', 'all');
  const selected = parseSelection(selectionInput, files);

  if (!selected) {
    console.log('終了しました。');
    return;
  }

  console.log(`\n対象: ${selected.join(', ')}\n`);

  console.log('── ドライラン（プレビュー）──\n');
  for (const file of selected) {
    await importOne(client, file, true);
  }

  const apply = await askYesNo('\n上記の内容で Sanity に書き込みますか', false);
  if (!apply) {
    console.log('書き込みは行いませんでした。');
    return;
  }

  console.log('\n── 書き込み中 ──\n');
  for (const file of selected) {
    await importOne(client, file, false);
  }

  console.log('\n完了。サイトに反映するには git push / Cloudflare 再デプロイを行ってください。');
}

main().catch((err) => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
