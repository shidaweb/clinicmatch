/**
 * Shared helpers for Sanity post import scripts.
 * Markdown → Portable Text (same logic as import_clinicmatch_articles.cjs).
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { createClient } = require('@sanity/client');

const PROJECT_ID = process.env.SANITY_PROJECT_ID || 'sjwdnh1q';
const DATASET = process.env.SANITY_DATASET || 'production';
const API_VERSION = process.env.SANITY_API_VERSION || '2024-01-01';

function loadWriteToken() {
  let token = process.env.SANITY_WRITE_TOKEN || '';
  if (token) return token;

  for (const envFile of ['.env.clinicmatch', '.env']) {
    try {
      const envPath = path.resolve(process.cwd(), envFile);
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/SANITY_WRITE_TOKEN\s*=\s*(.+)/);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    } catch (_) {
      /* ignore */
    }
  }
  return '';
}

function createSanityClient(token) {
  return createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: API_VERSION,
    token,
    useCdn: false,
  });
}

function generateKey() {
  return Math.random().toString(36).substring(2, 14);
}

function parseInlineMarks(text) {
  const spans = [];
  const parts = [];
  let pos = 0;
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > pos) {
      parts.push({ text: text.slice(pos, match.index), marks: [] });
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
  if (pos < text.length) {
    parts.push({ text: text.slice(pos), marks: [] });
  }
  if (parts.length === 0) {
    parts.push({ text, marks: [] });
  }

  for (const part of parts) {
    spans.push({
      _type: 'span',
      _key: generateKey(),
      text: part.text,
      marks: part.marks,
    });
  }

  return { spans, markDefs: [] };
}

function mdToPortableText(mdBody) {
  const lines = mdBody.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const style = level === 1 ? 'h2' : level <= 4 ? `h${level}` : 'normal';
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

    if (line.startsWith('>')) {
      const quoteLines = [];
      while (
        i < lines.length &&
        (lines[i].startsWith('>') ||
          (lines[i].trim() === '' && i + 1 < lines.length && lines[i + 1]?.startsWith('>')))
      ) {
        if (lines[i].startsWith('>')) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
        }
        i++;
      }
      for (const ql of quoteLines.join('\n').split('\n')) {
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

function loadDraftFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error(`Invalid frontmatter in ${filePath}`);
  }
  const meta = yaml.load(fmMatch[1]) || {};
  const body = mdToPortableText(fmMatch[2].trim());
  return { meta, body };
}

function normalizeFaqs(faqs) {
  if (!Array.isArray(faqs)) return [];
  return faqs
    .map((f) => ({
      _key: generateKey(),
      q: String(f.q || f.question || '').trim(),
      a: String(f.a || f.answer || '').trim(),
    }))
    .filter((f) => f.q && f.a);
}

module.exports = {
  PROJECT_ID,
  DATASET,
  API_VERSION,
  loadWriteToken,
  createSanityClient,
  generateKey,
  mdToPortableText,
  loadDraftFile,
  normalizeFaqs,
};
