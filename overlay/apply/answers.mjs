#!/usr/bin/env node
// career-kit answer bank — durable answers to recurring application-form
// questions (work authorization, sponsorship, notice period, EEO, …).
// Upstream career-ops persists answers per report; this bank is cross-application.
//
// Usage:
//   node apply/answers.mjs --lookup "Are you authorized to work in the US?"
//   node apply/answers.mjs --add --label "..." --answer "..." [--match "a,b"]
//   node apply/answers.mjs --list [--full]
//
// The bank lives in data/answers.yml — gitignored, local-only. --list prints
// labels only unless --full is given, so answers never leak into casual output.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'data', 'answers.yml');
const HEADER = `# career-kit answer bank — managed by apply/answers.mjs.
# Local-only and gitignored: this file can hold salary and EEO answers.
# Format reference: data/answers.example.yml
`;

function fail(msg) {
  console.error(`answers.mjs: ${msg}`);
  process.exit(1);
}

function load() {
  if (!existsSync(FILE)) return { answers: [] };
  let doc;
  try {
    doc = yaml.load(readFileSync(FILE, 'utf8'));
  } catch (err) {
    fail(`data/answers.yml is not valid YAML (${err.message}). Fix or remove it.`);
  }
  if (doc == null) return { answers: [] };
  if (!Array.isArray(doc.answers)) {
    fail('data/answers.yml must contain a top-level "answers:" list.');
  }
  return { answers: doc.answers };
}

function save(bank) {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, HEADER + yaml.dump(bank, { lineWidth: 100 }), 'utf8');
}

// Normalize a label for matching: lowercase, strip punctuation, collapse spaces.
function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--add' || a === '--list' || a === '--full') args[a.slice(2)] = true;
    else if (a === '--lookup' || a === '--label' || a === '--answer' || a === '--match') {
      args[a.slice(2)] = argv[++i];
      if (args[a.slice(2)] === undefined) fail(`${a} needs a value.`);
    } else args._.push(a);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const bank = load();

if (args.lookup !== undefined) {
  const q = norm(args.lookup);
  if (!q) fail('--lookup needs a non-empty label.');
  let hit =
    // 1. exact normalized label
    bank.answers.find((e) => norm(e.label) === q) ??
    // 2. any declared match term contained in the query
    bank.answers.find((e) =>
      (Array.isArray(e.match) ? e.match : []).some((t) => norm(t) && q.includes(norm(t)))
    ) ??
    // 3. substring either way, for labels long enough to be unambiguous
    bank.answers.find((e) => {
      const l = norm(e.label);
      return l.length >= 8 && q.length >= 8 && (q.includes(l) || l.includes(q));
    });
  console.log(
    JSON.stringify(
      hit ? { found: true, label: hit.label, answer: hit.answer } : { found: false },
      null,
      2
    )
  );
  process.exit(0);
}

if (args.add) {
  if (!args.label || !args.answer) fail('--add needs both --label and --answer.');
  const entry = {
    label: args.label,
    answer: args.answer,
    ...(args.match
      ? { match: args.match.split(',').map((t) => t.trim()).filter(Boolean) }
      : {}),
  };
  const idx = bank.answers.findIndex((e) => norm(e.label) === norm(args.label));
  const replaced = idx >= 0;
  if (replaced) bank.answers[idx] = { ...bank.answers[idx], ...entry };
  else bank.answers.push(entry);
  save(bank);
  console.log(
    JSON.stringify({ saved: true, replaced, label: entry.label, total: bank.answers.length })
  );
  process.exit(0);
}

if (args.list) {
  if (bank.answers.length === 0) {
    console.log('Answer bank is empty (data/answers.yml).');
    process.exit(0);
  }
  for (const e of bank.answers) {
    console.log(args.full ? `- ${e.label} → ${e.answer}` : `- ${e.label}`);
  }
  process.exit(0);
}

fail('nothing to do — use --lookup, --add, or --list. See file header for usage.');
