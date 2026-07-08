// Regression tests for overlay/apply/queue.mjs — the prioritized tracker view.
// Drives the real CLI as a subprocess, pointing CAREER_KIT_TRACKER at a
// throwaway fixture so a test never reads the recipient's real
// data/applications.md.
//
// Covers audit finding 8: a MISSING tracker (normal on day one) and a
// MALFORMED tracker (a file exists but has no recognizable table — a real
// problem) must report distinct reasons instead of a single "no tracker yet".
// Also pins the surrounding --next / --list behavior the fix must not disturb.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const QUEUE = fileURLToPath(new URL('../overlay/apply/queue.mjs', import.meta.url));

const MISSING_REASON = 'no tracker yet';
const MALFORMED_REASON = 'tracker file found but its table format was not recognized';

// A fresh fixture path in its own temp dir. With text, write applications.md;
// without it, leave the file absent (the "no tracker yet" case).
function fixture(text) {
  const dir = mkdtempSync(join(tmpdir(), 'career-kit-tracker-'));
  const path = join(dir, 'applications.md');
  if (text !== undefined) writeFileSync(path, text, 'utf8');
  return path;
}

function run(fixturePath, mode) {
  const res = spawnSync('node', [QUEUE, mode], {
    env: { ...process.env, CAREER_KIT_TRACKER: fixturePath },
    encoding: 'utf8',
  });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}

function json(fixturePath, mode) {
  const { code, stdout, stderr } = run(fixturePath, mode);
  assert.equal(code, 0, `${mode} exited ${code}: ${stderr}`);
  return JSON.parse(stdout);
}

const VALID = `# Applications

| # | Date | Company | Role | Score | Status |
|---|------|---------|------|-------|--------|
| 1 | 2026-07-01 | Acme | Engineer | 4.5 | evaluated |
| 2 | 2026-07-02 | Globex | Analyst | 3.2 | evaluated |
| 3 | 2026-07-03 | Initech | Developer | 4.8 | applied |
`;

// Header + separator but no data rows: a valid-but-empty table.
const EMPTY_TABLE = `# Applications

| # | Date | Company | Role | Score | Status |
|---|------|---------|------|-------|--------|
`;

// A file that exists but has no recognizable table.
const MALFORMED = `# Applications

Nothing here yet — I will paste jobs in later.
`;

// All rows terminal/applied, so no row is a --next candidate.
const NONE_EVALUATED = `# Applications

| # | Date | Company | Role | Score | Status |
|---|------|---------|------|-------|--------|
| 1 | 2026-07-01 | Acme | Engineer | 4.5 | applied |
| 2 | 2026-07-02 | Globex | Analyst | 3.2 | rejected |
`;

// Top evaluated job scores under the 4.0 proceed threshold.
const BELOW_THRESHOLD = `# Applications

| # | Date | Company | Role | Score | Status |
|---|------|---------|------|-------|--------|
| 1 | 2026-07-01 | Acme | Engineer | 3.5 | evaluated |
`;

// ---- Finding 8: missing vs malformed carry distinct reasons ----
test('--next on a missing tracker reports "no tracker yet"', () => {
  const out = json(fixture(), '--next');
  assert.equal(out.found, false);
  assert.equal(out.reason, MISSING_REASON);
});
test('--list on a missing tracker reports "no tracker yet"', () => {
  const out = json(fixture(), '--list');
  assert.deepEqual(out.rows, []);
  assert.equal(out.reason, MISSING_REASON);
});
test('--next on a malformed tracker reports the format reason, not "no tracker yet"', () => {
  const out = json(fixture(MALFORMED), '--next');
  assert.equal(out.found, false);
  assert.equal(out.reason, MALFORMED_REASON);
});
test('--list on a malformed tracker reports the format reason, not "no tracker yet"', () => {
  const out = json(fixture(MALFORMED), '--list');
  assert.deepEqual(out.rows, []);
  assert.equal(out.reason, MALFORMED_REASON);
});

// ---- A valid-but-empty table is "ok", distinct from missing/malformed ----
test('--list on a valid empty table returns no rows and no reason', () => {
  const out = json(fixture(EMPTY_TABLE), '--list');
  assert.deepEqual(out.rows, []);
  assert.equal('reason' in out, false, 'a well-formed empty table must not carry a reason');
});
test('--next on a valid empty table waits, it does not claim "no tracker yet"', () => {
  const out = json(fixture(EMPTY_TABLE), '--next');
  assert.equal(out.found, false);
  assert.equal(out.reason, 'no evaluated jobs waiting');
});

// ---- Surrounding behavior the fix must preserve ----
test('--next picks the highest-scoring evaluated job', () => {
  const out = json(fixture(VALID), '--next');
  assert.equal(out.found, true);
  assert.equal(out.company, 'Acme');
  assert.equal(out.score, 4.5);
  assert.equal(out.belowThreshold, false);
});
test('--next flags a top pick under the 4.0 threshold', () => {
  const out = json(fixture(BELOW_THRESHOLD), '--next');
  assert.equal(out.found, true);
  assert.equal(out.company, 'Acme');
  assert.equal(out.belowThreshold, true);
});
test('--next reports "no evaluated jobs waiting" when nothing is ready', () => {
  const out = json(fixture(NONE_EVALUATED), '--next');
  assert.equal(out.found, false);
  assert.equal(out.reason, 'no evaluated jobs waiting');
});
test('--list keeps rows and orders evaluated above applied', () => {
  const out = json(fixture(VALID), '--list');
  assert.equal(out.rows.length, 3);
  assert.equal(out.rows[0].status, 'evaluated');
  assert.equal(out.rows[out.rows.length - 1].status, 'applied');
});
