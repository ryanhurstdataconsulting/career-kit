#!/usr/bin/env node
// career-kit queue — a prioritized view over upstream's data/applications.md.
//
//   node apply/queue.mjs --next   best not-yet-applied job, as JSON
//   node apply/queue.mjs --list   all rows, most actionable first, as JSON
//
// Read-only: all tracker WRITES go through upstream set-status.mjs. The parser
// is deliberately standalone (no upstream imports) so upstream refactors can't
// break it; it reads the documented Markdown-table format only.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRACKER = join(ROOT, 'data', 'applications.md');
const PROCEED_THRESHOLD = 4.0; // upstream scoring: mean >= 4.0 means proceed

// Priority groups for --list: what needs her attention first.
// offer > interview > responded (in motion) > evaluated (ready to apply)
// > applied (waiting) > terminal states.
const STATUS_ORDER = {
  offer: 0,
  interview: 1,
  responded: 2,
  evaluated: 3,
  applied: 4,
  hired: 5,
  rejected: 6,
  discarded: 7,
  skip: 8,
};

// Strip markdown decoration and map a status cell onto a canonical state.
function canonStatus(cell) {
  const raw = String(cell).replace(/[*_`]/g, '').trim();
  const key = raw.toLowerCase();
  const aliases = {
    evaluated: 'evaluated',
    applied: 'applied',
    responded: 'responded',
    response: 'responded',
    interview: 'interview',
    interviewing: 'interview',
    offer: 'offer',
    rejected: 'rejected',
    rejection: 'rejected',
    discarded: 'discarded',
    skip: 'skip',
    skipped: 'skip',
    hired: 'hired',
  };
  return aliases[key] ?? key; // unknown states sort after known ones
}

function parseTracker(path) {
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, 'utf8').split('\n');
  const start = lines.findIndex(
    (l) => l.trim().startsWith('|') && /\|\s*company\s*\|/i.test(l)
  );
  if (start === -1 || !lines[start + 1] || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[start + 1])) {
    return null; // no recognizable table
  }
  const cells = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
  const headers = cells(lines[start]).map((h) => h.toLowerCase());
  const col = (...names) => headers.findIndex((h) => names.includes(h));
  const idx = {
    num: col('#'),
    date: col('date'),
    company: col('company'),
    role: col('role', 'position'),
    score: col('score'),
    status: col('status', 'state'),
    report: col('report'),
    pdf: col('pdf'),
    notes: col('notes', 'next'),
  };
  const rows = [];
  for (let i = start + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;
    const c = cells(lines[i]);
    const get = (k) => (idx[k] >= 0 && idx[k] < c.length ? c[idx[k]] : '');
    const scoreNum = parseFloat(get('score').replace(/[^\d.]/g, ''));
    rows.push({
      num: get('num'),
      date: get('date'),
      company: get('company').replace(/[*_`]/g, '').trim(),
      role: get('role').replace(/[*_`]/g, '').trim(),
      score: Number.isFinite(scoreNum) ? scoreNum : null,
      status: canonStatus(get('status')),
      report: get('report'),
      pdf: get('pdf'),
      notes: get('notes'),
    });
  }
  return rows;
}

const mode = process.argv[2];
if (mode !== '--next' && mode !== '--list') {
  console.error('queue.mjs: use --next or --list.');
  process.exit(1);
}

const rows = parseTracker(TRACKER);

if (mode === '--list') {
  if (rows === null) {
    console.log(JSON.stringify({ rows: [], reason: 'no tracker yet' }, null, 2));
    process.exit(0);
  }
  const sorted = [...rows].sort((a, b) => {
    const ga = STATUS_ORDER[a.status] ?? 99;
    const gb = STATUS_ORDER[b.status] ?? 99;
    if (ga !== gb) return ga - gb;
    return (b.score ?? -1) - (a.score ?? -1);
  });
  console.log(JSON.stringify({ rows: sorted }, null, 2));
  process.exit(0);
}

// --next: highest-scoring job that is evaluated but not yet applied to.
if (rows === null || rows.length === 0) {
  console.log(JSON.stringify({ found: false, reason: 'no tracker yet' }, null, 2));
  process.exit(0);
}
const candidates = rows
  .filter((r) => r.status === 'evaluated' && r.score !== null)
  .sort((a, b) => b.score - a.score);
if (candidates.length === 0) {
  console.log(
    JSON.stringify({ found: false, reason: 'no evaluated jobs waiting' }, null, 2)
  );
  process.exit(0);
}
const pick = candidates[0];
console.log(
  JSON.stringify(
    { found: true, ...pick, belowThreshold: pick.score < PROCEED_THRESHOLD },
    null,
    2
  )
);
