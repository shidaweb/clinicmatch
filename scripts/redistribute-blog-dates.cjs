#!/usr/bin/env node
/**
 * Spread all post publishedAt dates between 2026-01-01 and 2026-05-20 (JST).
 *
 *   node scripts/redistribute-blog-dates.cjs           # preview
 *   node scripts/redistribute-blog-dates.cjs --apply   # patch Sanity
 *   node scripts/redistribute-blog-dates.cjs --apply --update-drafts
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const {
  loadWriteToken,
  createSanityClient,
  PROJECT_ID,
  DATASET,
} = require('./lib/sanity-import-utils.cjs');

const DRAFTS_DIR = path.resolve(__dirname, '..', 'drafts');
const START = new Date('2026-01-01T09:00:00+09:00');
const END = new Date('2026-05-20T17:00:00+09:00');

function formatJstIso(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+09:00`;
}

function computeSchedule(count) {
  if (count < 1) return [];
  if (count === 1) return [formatJstIso(START)];

  const startMs = START.getTime();
  const endMs = END.getTime();
  const dates = [];

  for (let i = 0; i < count; i++) {
    const ratio = i / (count - 1);
    const ms = Math.round(startMs + (endMs - startMs) * ratio);
    const d = new Date(ms);
    // Slight minute offset so not all posts share the same clock time
    d.setMinutes(d.getMinutes() + (i % 47));
    dates.push(formatJstIso(d));
  }

  return dates;
}

async function fetchPosts(client) {
  return client.fetch(
    '*[_type == "post"]{ _id, "slug": slug.current, title, publishedAt } | order(publishedAt asc, slug asc)'
  );
}

function updateDraftFiles(scheduleBySlug) {
  const files = fs.readdirSync(DRAFTS_DIR).filter((f) => /^\d{2}-.+\.md$/.test(f));
  let updated = 0;

  for (const file of files) {
    const filePath = path.join(DRAFTS_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const m = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)([\s\S]*)$/);
    if (!m) continue;

    const meta = yaml.load(m[2]) || {};
    const slug = meta.slug;
    const next = scheduleBySlug.get(slug);
    if (!next) continue;

    meta.publishedAt = next;
    if (meta.updatedAt) meta.updatedAt = next;

    const nextFm = yaml.dump(meta, { lineWidth: -1, noRefs: true }).trimEnd();
    fs.writeFileSync(filePath, `${m[1]}${nextFm}\n${m[3]}${m[4]}`);
    updated++;
    console.log(`  [draft] ${file} → ${next.slice(0, 10)}`);
  }

  return updated;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const updateDrafts = process.argv.includes('--update-drafts');
  const token = loadWriteToken();

  if (apply && !token) {
    console.error('ERROR: SANITY_WRITE_TOKEN required for --apply');
    process.exit(1);
  }

  const client = createSanityClient(token || undefined);
  const posts = await fetchPosts(client);

  if (!posts.length) {
    console.log('No posts found.');
    return;
  }

  const dates = computeSchedule(posts.length);
  const scheduleBySlug = new Map();

  console.log(`project=${PROJECT_ID} dataset=${DATASET}`);
  console.log(`Range: ${formatJstIso(START).slice(0, 10)} … ${formatJstIso(END).slice(0, 10)}`);
  console.log(`Posts: ${posts.length}\n`);
  console.log('slug                          | old        | new');
  console.log('------------------------------+------------+------------');

  const patches = [];

  posts.forEach((post, i) => {
    const next = dates[i];
    scheduleBySlug.set(post.slug, next);
    const old = post.publishedAt ? post.publishedAt.slice(0, 10) : '(none)';
    const neu = next.slice(0, 10);
    console.log(`${post.slug.padEnd(30)}| ${old.padEnd(10)} | ${neu}`);
    patches.push({ id: post._id, slug: post.slug, publishedAt: next });
  });

  if (!apply) {
    console.log('\n[DRY] pass --apply to patch Sanity');
    if (updateDrafts) console.log('[DRY] --update-drafts would sync drafts/*.md frontmatter');
    return;
  }

  console.log('\nPatching Sanity...');
  let tx = client.transaction();
  for (const p of patches) {
    tx = tx.patch(p.id, { set: { publishedAt: p.publishedAt } });
  }
  await tx.commit();
  console.log(`Updated ${patches.length} posts.`);

  if (updateDrafts) {
    console.log('\nUpdating drafts/...');
    const n = updateDraftFiles(scheduleBySlug);
    console.log(`Updated ${n} draft file(s).`);
  }

  console.log('\nDone. Redeploy or wait for CDN if the site caches Sanity responses.');
}

main().catch((err) => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
