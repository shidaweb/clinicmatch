#!/usr/bin/env node
/**
 * Import blog drafts from drafts/*.md into Sanity (post documents).
 *
 * Usage:
 *   SANITY_WRITE_TOKEN=sk-... node scripts/import-drafts.cjs
 *   SANITY_WRITE_TOKEN=sk-... node scripts/import-drafts.cjs 01-candela-maintenance.md
 *   SANITY_WRITE_TOKEN=sk-... node scripts/import-drafts.cjs 01-candela-maintenance.md --apply
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

  if (mainImage && mainImage._ref) {
    payload.mainImage = mainImage;
  } else if (mainImage && mainImage.asset) {
    payload.mainImage = mainImage;
  }

  const mode = meta.mode || 'create';
  if (mode !== 'rewrite') {
    if (meta.publishedAt) payload.publishedAt = meta.publishedAt;
  } else if (existing?.publishedAt) {
    // publishedAt preserved on server document — not included in patch
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
    return;
  }

  const { meta, body } = loadDraftFile(filePath);
  const slug = meta.slug;
  const mode = meta.mode || 'create';

  if (!slug || !meta.title) {
    console.error(`SKIP: ${fileName} (missing title or slug)`);
    return;
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
    return;
  }

  if (mode !== 'rewrite' && existing) {
    console.log(`  NOTE: will patch existing document (same slug)`);
  }

  const docId = existing?._id || `post-${slug}`;
  const payload = buildPatchPayload(meta, body, existing, mainImage);

  if (dryRun) {
    console.log(`  [DRY] would ${existing ? 'patch' : 'create'} _id=${docId}`);
    console.log(JSON.stringify(payload, null, 2).slice(0, 2000) + (JSON.stringify(payload).length > 2000 ? '\n  ...' : ''));
    return;
  }

  if (mode === 'rewrite') {
    await backupExisting(client, slug);
    await client.patch(docId).set(payload).commit();
    console.log(`  [patch] ${slug} (${docId})`);
    return;
  }

  if (existing) {
    await backupExisting(client, slug);
    await client.patch(docId).set(payload).commit();
    console.log(`  [patch] ${slug} (${docId})`);
  } else {
    await client.create({ _id: docId, _type: 'post', ...payload });
    console.log(`  [create] ${slug} (${docId})`);
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dryRun = !process.argv.includes('--apply');

  const token = loadWriteToken();
  if (!dryRun && !token) {
    console.error('ERROR: SANITY_WRITE_TOKEN is required for --apply.');
    console.error('Set in environment or .env / .env.clinicmatch');
    process.exit(1);
  }

  const client = createSanityClient(token || undefined);
  if (dryRun && !token) {
    console.warn('WARN: no SANITY_WRITE_TOKEN — dry-run uses read-only API only\n');
  }

  const isDraftMd = (f) => /^\d{2}-.+\.md$/.test(f);
  const files = args.length
    ? args
    : fs.readdirSync(DRAFTS_DIR).filter(isDraftMd).sort();

  console.log(`Sanity import-drafts  project=${PROJECT_ID} dataset=${DATASET}`);
  console.log(dryRun ? 'MODE: dry-run (pass --apply to write)' : 'MODE: APPLY — writing to Sanity');

  for (const file of files) {
    await importOne(client, file, dryRun);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
