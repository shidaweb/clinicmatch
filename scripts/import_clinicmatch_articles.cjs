#!/usr/bin/env node
/**
 * ClinicMatch Sanity Import Script
 * Imports 50 blog articles from clinicmatch_articles/*.md into Sanity
 * Project: sjwdnh1q  Dataset: production  Document type: post
 *
 * Usage:
 *   SANITY_WRITE_TOKEN=sk-... node scripts/import_clinicmatch_articles.cjs
 *
 * Or create .env.clinicmatch with SANITY_WRITE_TOKEN=sk-...
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ──────────────────────────────────────────────
const PROJECT_ID = 'sjwdnh1q';
const DATASET = 'production';
const API_VERSION = '2024-01-01';

// Try loading token from env or .env.clinicmatch
let TOKEN = process.env.SANITY_WRITE_TOKEN || '';
if (!TOKEN) {
  try {
    const envPath = path.resolve(__dirname, '..', '.env.clinicmatch');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/SANITY_WRITE_TOKEN\s*=\s*(.+)/);
    if (match) TOKEN = match[1].trim();
  } catch (_) {}
}
if (!TOKEN) {
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/SANITY_WRITE_TOKEN\s*=\s*(.+)/);
    if (match) TOKEN = match[1].trim();
  } catch (_) {}
}
if (!TOKEN) {
  console.error('ERROR: SANITY_WRITE_TOKEN not found.');
  console.error('Set via env variable or in .env / .env.clinicmatch');
  process.exit(1);
}

// ── Slug mapping (filename → URL slug) ──────────────────
const SLUG_MAP = {
  '01_gmp_buy_guide':           'gentle-max-pro-guide',
  '02_gmp_pricing':             'gentle-max-pro-pricing',
  '03_gmp_vs_mediostar':        'gmp-vs-mediostar',
  '04_mediostar_guide':         'mediostar-guide',
  '05_soprano_guide':           'soprano-guide',
  '06_hair_removal_checklist':  'hair-removal-checklist',
  '07_new_vs_used_hair':        'new-vs-used-hair-removal',
  '08_picosure_guide':          'picosure-guide',
  '09_pico_comparison':         'pico-comparison',
  '10_pico_overview':           'pico-overview',
  '11_lumecca_guide':           'lumecca-guide',
  '12_m22_guide':               'm22-guide',
  '13_ipl_overview':            'ipl-overview',
  '14_ulthera_guide':           'ulthera-guide',
  '15_hifu_comparison':         'hifu-comparison',
  '16_potenza_guide':           'potenza-guide',
  '17_rf_comparison':           'rf-comparison',
  '18_coolsculpting_guide':     'coolsculpting-guide',
  '19_emsculpt_guide':          'emsculpt-guide',
  '20_body_contouring_overview':'body-contouring-overview',
  '21_gmp_sell':                'sell-gentle-max-pro',
  '22_gmp_sell_timing':         'sell-gmp-timing',
  '23_hair_removal_sell':       'sell-hair-removal',
  '24_pico_sell':               'sell-pico',
  '25_ipl_sell':                'sell-ipl',
  '26_hifu_sell':               'sell-hifu',
  '27_rf_sell':                 'sell-rf',
  '28_body_sell':               'sell-body-machine',
  '29_clinic_closing_sell':     'clinic-closing-equipment',
  '30_maximize_value':          'maximize-resale-value',
  '31_lease_end_sell':          'lease-end-equipment',
  '32_sell_channels':           'sell-channels-comparison',
  '33_clinic_opening_equipment':'clinic-opening-equipment',
  '34_cost_reduction_opening':  'cost-reduction-opening',
  '35_yakkinhou_guide':         'pharmaceutical-affairs-law',
  '36_maintenance_contracts':   'maintenance-contracts',
  '37_no_maintenance':          'no-maintenance-risks',
  '38_lease_vs_purchase':       'lease-vs-purchase',
  '39_installation_guide':      'installation-guide',
  '40_depreciation_tax':        'depreciation-tax-guide',
  '41_trouble_cases':           'trouble-cases',
  '42_market_trends_2025':      'market-trends-2025',
  '43_consumables_availability':'consumables-availability',
  '44_authenticity_verification':'authenticity-verification',
  '45_multi_clinic_strategy':   'multi-clinic-strategy',
  '46_hair_removal_clinic_opening':'hair-removal-clinic-opening',
  '47_dermatology_clinic_equipment':'dermatology-clinic-equipment',
  '48_demo_inspection':         'demo-inspection-guide',
  '49_peer_to_peer_risks':      'peer-to-peer-risks',
  '50_purchase_checklist':      'purchase-checklist',
};

// ── Markdown → Portable Text converter ──────────────────
function generateKey() {
  return Math.random().toString(36).substring(2, 14);
}

function parseInlineMarks(text) {
  // Convert bold, italic, bold+italic inline marks to Sanity spans
  const spans = [];
  const markDefs = [];
  let remaining = text;

  // Simple regex-based approach: split by **bold** and *italic*
  const parts = [];
  let pos = 0;
  // Match **bold** or *italic*
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let match;
  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > pos) {
      parts.push({ text: remaining.slice(pos, match.index), marks: [] });
    }
    if (match[2]) {
      parts.push({ text: match[2], marks: ['strong', 'em'] });
    } else if (match[3]) {
      parts.push({ text: match[3], marks: ['strong'] });
    } else if (match[4]) {
      parts.push({ text: match[4], marks: ['em'] });
    }
    pos = match.index + match[0].length;
  }
  if (pos < remaining.length) {
    parts.push({ text: remaining.slice(pos), marks: [] });
  }
  if (parts.length === 0) {
    parts.push({ text: remaining, marks: [] });
  }

  for (const part of parts) {
    spans.push({
      _type: 'span',
      _key: generateKey(),
      text: part.text,
      marks: part.marks,
    });
  }

  return { spans, markDefs };
}

function mdToPortableText(mdBody) {
  const lines = mdBody.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const style = level <= 4 ? `h${level}` : 'normal';
      const { spans, markDefs } = parseInlineMarks(headingMatch[2]);
      blocks.push({
        _type: 'block',
        _key: generateKey(),
        style,
        markDefs,
        children: spans,
      });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && (lines[i].startsWith('>') || (lines[i].trim() === '' && i + 1 < lines.length && lines[i + 1]?.startsWith('>')))) {
        if (lines[i].startsWith('>')) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
        }
        i++;
      }
      const quoteText = quoteLines.join('\n');
      // Split blockquote into sub-lines
      for (const ql of quoteText.split('\n')) {
        if (ql.trim() === '') continue;
        const { spans, markDefs } = parseInlineMarks(ql.replace(/^[-•]\s*/, ''));
        blocks.push({
          _type: 'block',
          _key: generateKey(),
          style: 'blockquote',
          markDefs,
          children: spans,
        });
      }
      continue;
    }

    // Unordered list
    if (line.match(/^[-•]\s+/)) {
      while (i < lines.length && lines[i].match(/^[-•]\s+/)) {
        const itemText = lines[i].replace(/^[-•]\s+/, '');
        const { spans, markDefs } = parseInlineMarks(itemText);
        blocks.push({
          _type: 'block',
          _key: generateKey(),
          style: 'normal',
          listItem: 'bullet',
          level: 1,
          markDefs,
          children: spans,
        });
        i++;
      }
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\.\s+/)) {
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        const itemText = lines[i].replace(/^\d+\.\s+/, '');
        const { spans, markDefs } = parseInlineMarks(itemText);
        blocks.push({
          _type: 'block',
          _key: generateKey(),
          style: 'normal',
          listItem: 'number',
          level: 1,
          markDefs,
          children: spans,
        });
        i++;
      }
      continue;
    }

    // Normal paragraph
    const { spans, markDefs } = parseInlineMarks(line);
    blocks.push({
      _type: 'block',
      _key: generateKey(),
      style: 'normal',
      markDefs,
      children: spans,
    });
    i++;
  }

  return blocks;
}

// ── Parse frontmatter ───────────────────────────────────
function parseMd(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const fm = {};
  for (const line of fmMatch[1].split('\n')) {
    const m = line.match(/^(\w+):\s*['"]?(.+?)['"]?\s*$/);
    if (m) fm[m[1]] = m[2];
  }
  return { frontmatter: fm, body: fmMatch[2].trim() };
}

// ── Sanity API helpers ──────────────────────────────────
function sanityMutate(mutations) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ mutations });
    const options = {
      hostname: `${PROJECT_ID}.api.sanity.io`,
      path: `/v${API_VERSION}/data/mutate/${DATASET}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Main ────────────────────────────────────────────────
async function main() {
  const articlesDir = path.resolve(__dirname, '..', 'clinicmatch_articles');
  const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith('.md')).sort();

  console.log(`Found ${files.length} articles to import.\n`);

  let created = 0;
  let errors = 0;
  const now = new Date().toISOString();

  for (const file of files) {
    const stem = file.replace('.md', '');
    const slug = SLUG_MAP[stem];
    if (!slug) {
      console.log(`SKIP: ${file} (no slug mapping)`);
      continue;
    }

    const content = fs.readFileSync(path.join(articlesDir, file), 'utf8');
    const parsed = parseMd(content);
    if (!parsed) {
      console.log(`SKIP: ${file} (parse error)`);
      errors++;
      continue;
    }

    const { frontmatter, body } = parsed;
    const portableText = mdToPortableText(body);
    const docId = `post-${slug}`;

    const doc = {
      _id: docId,
      _type: 'post',
      title: frontmatter.title || stem,
      slug: { _type: 'slug', current: slug },
      publishedAt: now,
      excerpt: frontmatter.description || '',
      category: frontmatter.category || 'ops',
      tags: [],
      body: portableText,
    };

    try {
      await sanityMutate([{ createOrReplace: doc }]);
      console.log(`OK: ${file} → ${slug}`);
      created++;
    } catch (err) {
      console.error(`ERROR: ${file} → ${err.message}`);
      errors++;
    }

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone. Created: ${created}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
