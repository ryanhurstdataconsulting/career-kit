// Regression tests for overlay/apply/submit-guard.mjs — the never-submit gate.
// Spawns the guard the way Claude Code's PreToolUse hook does: a JSON payload on
// stdin. Exit 2 = blocked (with a "SUBMIT GUARD" reason on stderr); exit 0 = allowed.
//
// Covers audit findings 1 (press_key Enter), 2 (scripted click/keypress escapes
// in evaluate/run_code_unsafe), and 3 (a submit-labeled form FIELD must not be a
// false positive, while a submit BUTTON stays blocked).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GUARD = fileURLToPath(new URL('../overlay/apply/submit-guard.mjs', import.meta.url));

function runGuard(payload) {
  const res = spawnSync('node', [GUARD], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
  });
  return { code: res.status, stderr: res.stderr };
}

const blocked = (payload) => {
  const { code, stderr } = runGuard(payload);
  assert.equal(code, 2, `expected block (exit 2), got ${code}`);
  assert.match(stderr, /SUBMIT GUARD: blocked/, 'expected a SUBMIT GUARD reason on stderr');
};
const allowed = (payload) => {
  const { code } = runGuard(payload);
  assert.equal(code, 0, `expected allow (exit 0), got ${code}`);
};

// ---- Finding 1: browser_press_key with a submit key ----
test('press_key Enter is blocked', () => {
  blocked({ tool_name: 'mcp__playwright__browser_press_key', tool_input: { key: 'Enter' } });
});
test('press_key Return is blocked', () => {
  blocked({ tool_name: 'mcp__playwright__browser_press_key', tool_input: { key: 'Return' } });
});
test('press_key NumpadEnter is blocked', () => {
  blocked({ tool_name: 'mcp__playwright__browser_press_key', tool_input: { key: 'NumpadEnter' } });
});
test('press_key Tab is allowed', () => {
  allowed({ tool_name: 'mcp__playwright__browser_press_key', tool_input: { key: 'Tab' } });
});
test('press_key ArrowDown is allowed', () => {
  allowed({ tool_name: 'mcp__playwright__browser_press_key', tool_input: { key: 'ArrowDown' } });
});

// ---- Finding 2: scripted clicks / keypresses in evaluate & run_code_unsafe ----
test('evaluate: form.submit() is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_evaluate',
    tool_input: { function: '() => document.querySelector("form").submit()' },
  });
});
test('evaluate: requestSubmit() is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_evaluate',
    tool_input: { function: '() => document.forms[0].requestSubmit()' },
  });
});
test('evaluate: scripted .click() on a non-submit-named element is blocked', () => {
  // Escapes the old guard: no "submit" text anywhere in the code.
  blocked({
    tool_name: 'mcp__playwright__browser_evaluate',
    tool_input: { function: '() => document.querySelector("#apply-btn").click()' },
  });
});
test('evaluate: scripted .dblclick() is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_evaluate',
    tool_input: { function: '() => el.dblclick()' },
  });
});
test('run_code_unsafe: keyboard.press("Enter") is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: { code: 'await page.keyboard.press("Enter")' },
  });
});
test('run_code_unsafe: keyboard.down("Enter") is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: { code: 'await page.keyboard.down("Enter")' },
  });
});
test('run_code_unsafe: keyboard.press("Tab") is allowed', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: { code: 'await page.keyboard.press("Tab")' },
  });
});
test('evaluate: a benign DOM read is allowed', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_evaluate',
    tool_input: { function: '() => document.querySelectorAll("input").length' },
  });
});
test('evaluate: mousedown (not a scripted click) is allowed', () => {
  // Guards against a .down( / .click( over-match on unrelated APIs.
  allowed({
    tool_name: 'mcp__playwright__browser_evaluate',
    tool_input: { function: '() => el.dispatchEvent(new MouseEvent("mousedown"))' },
  });
});

// ---- Finding 3: submit-labeled FIELD is exempt; submit BUTTON stays blocked ----
test('click on a submit BUTTON is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_click',
    tool_input: { element: 'Submit application button' },
  });
});
test('click on a submit-labeled text FIELD is allowed', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_click',
    tool_input: { element: 'Submit your GitHub URL text field' },
  });
});
test('click on a plain text field is allowed', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_click',
    tool_input: { element: 'First name text field' },
  });
});
test('click on a submit link is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_click',
    tool_input: { element: 'Submit application link' },
  });
});

// ---- Existing behavior that must not regress ----
test('type with submit:true is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_type',
    tool_input: { element: 'Search', text: 'x', submit: true },
  });
});
test('type with submit:false is allowed', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_type',
    tool_input: { element: 'Search', text: 'x', submit: false },
  });
});
test('unparseable stdin is allowed (exit 0)', () => {
  allowed('this is not json');
});
test('an unrelated tool is allowed', () => {
  allowed({ tool_name: 'mcp__playwright__browser_snapshot', tool_input: {} });
});

// ---- Finding 4: Ctrl/Cmd/Meta+Enter accelerator; filename source is fail-closed ----
test('press_key Control+Enter is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_press_key',
    tool_input: { key: 'Control+Enter' },
  });
});
test('press_key Meta+Enter is blocked', () => {
  blocked({ tool_name: 'mcp__playwright__browser_press_key', tool_input: { key: 'Meta+Enter' } });
});
test('press_key Shift+Enter is allowed (newline, not a submit)', () => {
  allowed({ tool_name: 'mcp__playwright__browser_press_key', tool_input: { key: 'Shift+Enter' } });
});
test('run_code_unsafe: a filename source is blocked (cannot be reviewed)', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: { filename: '/tmp/x.js' },
  });
});
test('run_code_unsafe: keyboard.press("Control+Enter") is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: { code: 'await page.keyboard.press("Control+Enter")' },
  });
});
test('run_code_unsafe: keyboard.press("Shift+Enter") is allowed', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: { code: 'await page.keyboard.press("Shift+Enter")' },
  });
});
