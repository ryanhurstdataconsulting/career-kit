// Regression tests for overlay/apply/answers.mjs — the durable answer bank.
// Drives the real CLI as a subprocess, pointing CAREER_KIT_ANSWERS at a
// throwaway fixture so a test never reads or writes the recipient's real
// data/answers.yml (which holds salary and EEO answers).
//
// Covers audit findings 5 (a short match term must hit only on whole-token
// boundaries, not as a substring of another word), 6 (punctuation inside a word
// collapses so "U.S." matches the bare "us" token), and 7 (a padded --label is
// stored trimmed, on both the add and the replace path).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ANSWERS = fileURLToPath(new URL('../overlay/apply/answers.mjs', import.meta.url));

// A fresh fixture path in its own temp dir. With yamlText, seed the bank;
// without it, leave the file absent (the "no bank yet" case).
function fixture(yamlText) {
  const dir = mkdtempSync(join(tmpdir(), 'career-kit-answers-'));
  const path = join(dir, 'answers.yml');
  if (yamlText !== undefined) writeFileSync(path, yamlText, 'utf8');
  return path;
}

function run(fixturePath, ...args) {
  const res = spawnSync('node', [ANSWERS, ...args], {
    env: { ...process.env, CAREER_KIT_ANSWERS: fixturePath },
    encoding: 'utf8',
  });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}

function lookup(fixturePath, q) {
  const { code, stdout, stderr } = run(fixturePath, '--lookup', q);
  assert.equal(code, 0, `lookup exited ${code}: ${stderr}`);
  return JSON.parse(stdout);
}

const WORK_AUTH = `answers:
  - label: Work authorization status
    answer: "Authorized to work in the United States"
    match:
      - us
      - work authorization
`;

// ---- Finding 5: whole-token matching, no substring false positives ----
test('a short match term hits as a whole token', () => {
  assert.equal(lookup(fixture(WORK_AUTH), 'Are you authorized to work in the US?').found, true);
});
test('a short match term does not fire on a substring of another word', () => {
  // "us" lives inside "business" but must not match as a token.
  assert.equal(lookup(fixture(WORK_AUTH), 'Do you have prior business experience?').found, false);
});
test('a multi-word match term matches as consecutive tokens', () => {
  assert.equal(lookup(fixture(WORK_AUTH), 'What is your current work authorization?').found, true);
});

// ---- Finding 6: intra-word punctuation collapses to the bare token ----
test('U.S. collapses to the "us" token and matches', () => {
  assert.equal(lookup(fixture(WORK_AUTH), 'Are you authorized to work in the U.S.?').found, true);
});

// ---- Finding 7: a padded --label is stored trimmed ----
test('--add stores a trimmed label (add path)', () => {
  const f = fixture('answers:\n  - label: seed\n    answer: "x"\n');
  const add = run(f, '--add', '--label', '  Salary expectation  ', '--answer', 'Negotiable');
  assert.equal(add.code, 0, add.stderr);
  const { stdout } = run(f, '--list');
  // The exact-line match fails if any leading/trailing space survived.
  assert.match(stdout, /^- Salary expectation$/m, `padding leaked into the stored label:\n${stdout}`);
});
test('re-adding with a padded label replaces in place and stays trimmed (replace path)', () => {
  const f = fixture('answers:\n  - label: Salary expectation\n    answer: "Old"\n');
  const out = JSON.parse(
    run(f, '--add', '--label', '  Salary expectation  ', '--answer', 'New').stdout
  );
  assert.equal(out.replaced, true);
  assert.equal(out.total, 1);
  assert.equal(out.label, 'Salary expectation');
  const hit = lookup(f, 'Salary expectation');
  assert.equal(hit.answer, 'New');
});

// ---- The CAREER_KIT_ANSWERS seam + graceful empty-bank behavior ----
test('lookup on a missing bank returns found:false without crashing', () => {
  assert.equal(lookup(fixture(), 'Anything at all here').found, false);
});
test('--list on an empty bank reports it is empty', () => {
  const { code, stdout } = run(fixture(), '--list');
  assert.equal(code, 0);
  assert.match(stdout, /empty/i);
});
