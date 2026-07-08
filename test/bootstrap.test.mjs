// Regression tests for the fresh-clone bootstrap invariant.
//
// CLAUDE.md was relocated out of overlay/ and into the tracked repo root so it
// exists the moment the repo is cloned — before setup.sh runs — and can drive
// the proactive link-onboarding first-run flow. These tests lock that layout in
// place: the root file exists and is git-tracked, the old overlay copy is gone
// (guarding against re-introducing a duplicate that would drift or get clobbered
// by the upstream sync), the root file still carries the load-bearing first-run
// markers, and setup.sh still protects it from the upstream rsync.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const root = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const repoDir = dirname(root('package.json'));

test('CLAUDE.md is a tracked file at the repo root', () => {
  assert.ok(existsSync(root('CLAUDE.md')), 'root CLAUDE.md should exist on disk');
});

test('overlay/CLAUDE.md does NOT exist (no duplicate to drift or be clobbered)', () => {
  assert.ok(
    !existsSync(root('overlay/CLAUDE.md')),
    'overlay/CLAUDE.md must be gone — the kit ships exactly one CLAUDE.md, at the repo root',
  );
});

test('CLAUDE.md is tracked by git', (t) => {
  const git = spawnSync(
    'git',
    ['-C', repoDir, 'ls-files', '--error-unmatch', 'CLAUDE.md'],
    { encoding: 'utf8' },
  );
  if (git.error) {
    t.skip('git is not available in this environment');
    return;
  }
  assert.equal(
    git.status,
    0,
    'git ls-files should confirm CLAUDE.md is tracked (present at clone time)',
  );
});

test('root CLAUDE.md carries the proactive first-run bootstrap markers', () => {
  const text = readFileSync(root('CLAUDE.md'), 'utf8');
  // Step 1 (install), step 2 (Simplify/Chrome via the doctor + launcher).
  assert.match(text, /\.\/setup\.sh/, 'should tell the agent to run ./setup.sh');
  assert.match(text, /node_modules/, 'should check the not-installed state');
  assert.match(text, /apply\/doctor\.mjs/, 'should gate step 2 on the doctor');
  assert.match(text, /\.\/apply\/launch-chrome\.sh/, 'should launch the job-hunt Chrome');
  assert.match(text, /simplify/i, 'should mention Simplify');
  assert.match(text, /never submit/i, 'must preserve the never-submit house rule');
});

test('setup.sh protects the root CLAUDE.md from the upstream sync', () => {
  const setup = readFileSync(root('setup.sh'), 'utf8');
  assert.match(
    setup,
    /--exclude=\/CLAUDE\.md/,
    'setup.sh must anchor-exclude /CLAUDE.md so the upstream rsync never overwrites the kit copy',
  );
});
