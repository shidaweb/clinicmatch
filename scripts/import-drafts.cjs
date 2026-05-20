#!/usr/bin/env node
/**
 * Import blog drafts from drafts/*.md into Sanity (post documents).
 *
 * Usage:
 *   node scripts/import-drafts.cjs
 *   node scripts/import-drafts.cjs 01-candela-maintenance.md --apply
 *
 * Interactive (token prompt):
 *   npm run sanity:import
 *
 * Always dry-run by default. Pass --apply to write to Sanity.
 */
const fs = require('fs');
const path = require('path');
const {
  loadWriteToken,
  createSanityClient,
  loadDraftFile,
  normalizeFaqs,
  PROJECT_ID,
  DATASET,
} = require('./lib/sanity-import-utils.cjs');

const DRAFTS_DIR = path.resolve(__dirname, '..', 'drafts');
const BACKUPS_DIR = path.resolve(__dirname, '..', 'backups');

const VALID_CATEGORIES = new Set([
  'hair-removal',
  'pico',
  'ipl',
  'hifu',
  'rf',
  'body',
  'ops',
  'pricing',
]);

const isDraftMd = (f) => /^\d{2}-.+\.md$/.test(f);

function listDraftFiles() {
  if (!fs.existsSync(DRAFTS_DIR)) return [];
  return fs.readdirSync(DRAFTS_DIR).filter(isDraftMd).sort();
}

function resolveHeroImage(client, heroImage, dryRun) {
  if (!heroImage || heroImage === 'null') return null;
  const localPath = path.isAbsolute(heroImage)
    ? heroImage
    : path.resolve(process.cwd(), heroImage);
  if (!fs.existsSync(localPath)) {
    console.warn(`  [warn] heroImage not found: ${localPath}`);
    return null;
  }
  if (dryRun) {
    console.log(`  [dry] would upload image: ${localPath}`);
    return { _type: 'image', _sanityAsset: `image@${localPath}` };
  }
  return client.assets
    .upload('image', fs.createReadStream(localPath), { filename: path.basename(localPath) })
    .then((asset) => ({
      _type: 'image',
      asset: { _type: 'reference', _ref: asset._id },
    }));
}

function buildPatchPayload(meta, body, existing, mainImage) {
  const payload = {
    title: meta.title,
    slug: { _type: 'slug', current: meta.slug },
    excerpt: meta.description || '',
    category: meta.category,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    body,
    faqs: normalizeFaqs(meta.faqs),
  };

  if (mainImage && (mainImage._ref || mainImage.asset)) {
    payload.mainImage = mainImage;
  }

  const mode = meta.mode || 'create';
  if (mode !== 'rewrite' && meta.publishedAt) {
    payload.publishedAt = meta.publishedAt;
  }

  return payload;
}

async function backupExisting(client, slug) {
  const doc = await client.fetch('*[_type == "post" && slug.current == $slug][0]', { slug });
  if (!doc) return null;
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(BACKUPS_DIR, `${slug}-${stamp}.json`);
  fs.writeFileSync(out, JSON.stringify(doc, null, 2));
  console.log(`  [backup] ${out}`);
  return doc;
}

async function importOne(client, fileName, dryRun) {
  const filePath = path.join(DRAFTS_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.error(`SKIP: ${fileName} (file not found)`);
    return { ok: false, fileName };
  }

  const { meta, body } = loadDraftFile(filePath);
  const slug = meta.slug;
  const mode = meta.mode || 'create';

  if (!slug || !meta.title) {
    console.error(`SKIP: ${fileName} (missing title or slug)`);
    return { ok: false, fileName };
  }

  if (meta.category && !VALID_CATEGORIES.has(meta.category)) {
    console.warn(`  [warn] unknown category "${meta.category}" — check schema list`);
  }

  const existing = await client.fetch('*[_type == "post" && slug.current == $slug][0]{_id, publishedAt, title}', {
    slug,
  });

  const mainImage = await resolveHeroImage(client, meta.heroImage, dryRun);

  console.log(`\n── ${fileName}`);
  console.log(`  mode: ${mode}  slug: ${slug}`);
  console.log(`  title: ${meta.title}`);
  console.log(`  category: ${meta.category}  tags: ${(meta.tags || []).join(', ')}`);
  console.log(`  body blocks: ${body.length}  faqs: ${normalizeFaqs(meta.faqs).length}`);
  console.log(`  existing: ${existing ? existing._id : '(none)'}`);

  if (mode === 'rewrite' && !existing) {
    console.error(`  ERROR: rewrite mode but no existing post for slug "${slug}"`);
    return { ok: false, fileName };
  }

  if (mode !== 'rewrite' && existing) {
    console.log(`  NOTE: will patch existing document (same slug)`);
  }

  const docId = existing?._id || `post-${slug}`;
  const payload = buildPatchPayload(meta, body, existing, mainImage);

  if (dryRun) {
    console.log(`  [DRY] would ${existing ? 'patch' : 'create'} _id=${docId}`);
    const preview = JSON.stringify(payload, null, 2);
    console.log(preview.slice(0, 1200) + (preview.length > 1200 ? '\n  ...' : ''));
    return { ok: true, fileName, dryRun: true };
  }

  if (mode === 'rewrite' || existing) {
    await backupExisting(client, slug);
    await client.patch(docId).set(payload).commit();
    console.log(`  [patch] ${slug} (${docId})`);
  } else {
    await client.create({ _id: docId, _type: 'post', ...payload });
    console.log(`  [create] ${slug} (${docId})`);
  }

  return { ok: true, fileName, applied: true };
}

async function runImport({ token, dryRun = true, files } = {}) {
  const resolvedToken = token ?? loadWriteToken();
  if (!dryRun && !resolvedToken) {
    throw new Error('SANITY_WRITE_TOKEN is required for --apply');
  }

  const client = createSanityClient(resolvedToken || undefined);
  const targetFiles = files?.length ? files : listDraftFiles();

  console.log(`Sanity import-drafts  project=${PROJECT_ID} dataset=${DATASET}`);
  console.log(dryRun ? 'MODE: dry-run' : 'MODE: APPLY');

  for (const file of targetFiles) {
    await importOne(client, file, dryRun);
  }

  return targetFiles;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dryRun = !process.argv.includes('--apply');
  const token = loadWriteToken();

  if (!dryRun && !token) {
    console.error('ERROR: SANITY_WRITE_TOKEN is required for --apply.');
    console.error('Use: npm run sanity:import  (interactive)');
    process.exit(1);
  }

  if (dryRun && !token) {
    console.warn('WARN: no SANITY_WRITE_TOKEN — dry-run uses read-only API only\n');
  }

  const files = args.length ? args : listDraftFiles();
  await runImport({ token, dryRun, files });
  console.log('\nDone.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}

module.exports = {
  DRAFTS_DIR,
  listDraftFiles,
  importOne,
  runImport,
};
