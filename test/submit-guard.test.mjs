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

// ---- Re-review fix: `filename` means different things in the two script tools ----
// browser_run_code_unsafe LOADS code from `filename` (fail-open risk → refused);
// browser_evaluate only SAVES its result there, so a filename is harmless and the
// `function` is still what gets scanned. The filename refusal must not over-block
// a legitimate evaluate-and-save.
test('evaluate: a benign read that saves to a filename is allowed', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_evaluate',
    tool_input: { function: '() => document.title', filename: '/tmp/title.txt' },
  });
});
test('evaluate: a scripted submit is still blocked even when a filename is set', () => {
  // The filename must not short-circuit the scan of `function`.
  blocked({
    tool_name: 'mcp__playwright__browser_evaluate',
    tool_input: { function: '() => document.forms[0].submit()', filename: '/tmp/out.txt' },
  });
});

// ---- Re-review fix: the key is the SECOND arg of page.press / frame.press ----
// keyboard.press(key) / locator.press(key) take the key first, but
// page.press(selector, key) / frame.press(selector, key) take the selector first
// and the key second. The scan must inspect the second quoted argument too, or a
// scripted `page.press('#field', 'Enter')` slips a submit through run_code_unsafe.
test('run_code_unsafe: page.press(selector, "Enter") is blocked (key is 2nd arg)', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: { code: "async (page) => { await page.press('#message', 'Enter'); }" },
  });
});
test('run_code_unsafe: page.press(selector, "Enter") double-quoted is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: { code: 'async (page) => { await page.press("#search", "Enter"); }' },
  });
});
test('run_code_unsafe: frame.press(selector, "Enter") via mainFrame() is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: { code: "async (page) => { await page.mainFrame().press('#q', 'Enter'); }" },
  });
});
test('run_code_unsafe: page.press(selector, "Control+Enter") is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: { code: "async (page) => { await page.press('#c', 'Control+Enter'); }" },
  });
});
test('run_code_unsafe: page.press(selector, "Tab") is allowed (2nd-arg non-submit key)', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: { code: "async (page) => { await page.press('#c', 'Tab'); }" },
  });
});
test('run_code_unsafe: page.press(selector, "Shift+Enter") is allowed (newline)', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: { code: "async (page) => { await page.press('#c', 'Shift+Enter'); }" },
  });
});

// ---- Re-review fix: browser_click's `target` is required, `element` optional ----
// The tool schema makes `target` (a snapshot ref or CSS selector) required and
// `element` (a human description) optional. A submit click can therefore arrive
// with only `target` and no description to scan, so a type=submit control must be
// refused from `target` too — while a benign field targeted by selector must not
// over-block.
test('click: bare target button[type=submit] with no element is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_click',
    tool_input: { target: 'button[type=submit]' },
  });
});
test('click: bare target input[type="submit"] with no element is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_click',
    tool_input: { target: 'input[type="submit"]' },
  });
});
test('click: a benign field targeted by selector is allowed', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_click',
    tool_input: { target: '#first-name' },
  });
});

// ---- Re-review fix: a synthetic / Playwright-dispatched click also submits ----
// A .click()/.dblclick() method call is not the only scripted click. Dispatching a
// synthetic DOM click — el.dispatchEvent(new MouseEvent('click')), a PointerEvent, a
// plain Event, or the legacy initMouseEvent('click', …) — runs the target's
// activation behavior, so a submit button submits with no `.click(` in the source.
// Playwright's own dispatchEvent helper does the same and, like .press(), takes the
// event type either first (locator.dispatchEvent('click')) or second
// (page.dispatchEvent(selector, 'click')). All must block. A non-activating event —
// mousedown, or an 'input'/'change' event fired to notify a framework — must stay
// allowed.
test('evaluate: dispatchEvent(new MouseEvent("click")) is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_evaluate',
    tool_input: {
      function:
        "() => document.querySelector('button[type=submit]').dispatchEvent(new MouseEvent('click'))",
    },
  });
});
test('run_code_unsafe: page.evaluate dispatching a synthetic click is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: {
      code:
        "async (page) => { await page.evaluate(() => document.querySelector('button[type=submit]').dispatchEvent(new MouseEvent('click'))); }",
    },
  });
});
test('run_code_unsafe: page.dispatchEvent(selector, "click") is blocked (type is 2nd arg)', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: {
      code: "async (page) => { await page.dispatchEvent('button[type=submit]', 'click'); }",
    },
  });
});
test('run_code_unsafe: locator.dispatchEvent("click") is blocked (type is 1st arg)', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: {
      code: "async (page) => { await page.locator('#submit').dispatchEvent('click'); }",
    },
  });
});
test('evaluate: dispatchEvent(new PointerEvent("click")) is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_evaluate',
    tool_input: { function: "() => btn.dispatchEvent(new PointerEvent('click'))" },
  });
});
test('evaluate: legacy initMouseEvent("click") is blocked', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_evaluate',
    tool_input: {
      function:
        "() => { const e = document.createEvent('MouseEvents'); e.initMouseEvent('click', true, true); btn.dispatchEvent(e); }",
    },
  });
});
test('evaluate: dispatchEvent(new Event("input")) is allowed (framework notify, not a click)', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_evaluate',
    tool_input: {
      function: "() => input.dispatchEvent(new Event('input', { bubbles: true }))",
    },
  });
});
test('run_code_unsafe: page.dispatchEvent(selector, "input") is allowed', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_run_code_unsafe',
    tool_input: { code: "async (page) => { await page.dispatchEvent('#email', 'input'); }" },
  });
});

// ---- Re-review fix: two fail-closed over-blocks the hardening diff introduced ----
// (a) SUBMIT_TYPE_RE must match only the HTML `type=submit` attribute, not a custom
// `data-type=submit` — the latter is a legitimate selector the diff wrongly blocked.
// The real type=submit selector must still block (see the bare-target cases above).
test('click: bare target [data-type=submit] is allowed (custom attr, not type=submit)', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_click',
    tool_input: { target: '[data-type=submit]' },
  });
});
test('click: bare target [type=submit] still blocks after the lookbehind change', () => {
  blocked({
    tool_name: 'mcp__playwright__browser_click',
    tool_input: { target: '[type=submit]' },
  });
});
// (b) FIELD_RE must recognize a textarea, so a submit-labeled cover-letter textarea
// is treated as a field to focus (allowed), not a submit button (blocked). A submit
// BUTTON with no field word still loses to BUTTON_RE and stays blocked (covered above).
test('click on a submit-labeled textarea is allowed', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_click',
    tool_input: { element: 'Submit your cover letter textarea' },
  });
});
test('click on a submit-labeled text area (spaced) is allowed', () => {
  allowed({
    tool_name: 'mcp__playwright__browser_click',
    tool_input: { element: 'Submit your response text area' },
  });
});
