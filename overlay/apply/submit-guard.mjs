#!/usr/bin/env node
// career-kit submit guard — a Claude Code PreToolUse hook.
//
// Blocks any Playwright-MCP action that could submit a job application. The
// human always reviews the filled form and clicks Submit herself. There is
// deliberately no override flag: a blocked call here is the system working.
//
// Wired in .claude/settings.json for: browser_click, browser_type,
// browser_press_key, browser_evaluate, browser_run_code_unsafe. Exit code 2
// blocks the call and feeds stderr back to the agent.

const SUBMIT_RE =
  /\bsubmit\b|\bsend\s+(my\s+|your\s+)?application\b|\bfinish\s+application\b|\bcomplete\s+application\b|\bconfirm\s+application\b/i;

// A submit-looking label that is clearly a form field the agent needs to focus
// (a text field, combobox, etc.) rather than a submit BUTTON — e.g. "Submit
// your GitHub URL text field". FIELD_RE must describe an input; BUTTON_RE
// (a button or link) always wins, so "Submit application button" stays blocked.
const FIELD_RE =
  /\b(?:text\s*field|text\s*box|textbox|input|combobox|listbox|checkbox|radio|dropdown|select|url\s*field|email\s*field|search\s*(?:field|box)|field)\b/i;
const BUTTON_RE = /\bbutton\b|\blink\b/i;

// Keys that can submit a form when pressed with focus in a field.
const SUBMIT_KEY_RE = /^(?:Enter|Return|NumpadEnter)$/i;

const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    process.exit(0); // unparseable input — not a browser call we can judge
  }

  const tool = String(payload.tool_name || '');
  const input = payload.tool_input || {};

  const deny = (why) => {
    console.error(
      `SUBMIT GUARD: blocked ${tool} — ${why} career-kit never submits an ` +
        `application; the human reviews the filled form and clicks Submit ` +
        `herself. Leave the page open and hand it back for her review.`
    );
    process.exit(2);
  };

  if (tool === 'mcp__playwright__browser_click') {
    const label = String(input.element ?? '');
    if (SUBMIT_RE.test(label)) {
      // Exempt a submit-labeled control only when it is clearly a form field
      // (e.g. "Submit your GitHub URL text field"), never a button or link.
      const isField = FIELD_RE.test(label) && !BUTTON_RE.test(label);
      if (!isField) {
        deny(`the target element ("${label}") looks like a submit control.`);
      }
    }
  }

  if (tool === 'mcp__playwright__browser_type' && input.submit === true) {
    deny('typing with submit: true presses Enter, which can submit a form.');
  }

  if (tool === 'mcp__playwright__browser_press_key') {
    const key = String(input.key ?? '');
    if (SUBMIT_KEY_RE.test(key)) {
      deny(`pressing "${key}" can submit the form.`);
    }
  }

  if (
    tool === 'mcp__playwright__browser_evaluate' ||
    tool === 'mcp__playwright__browser_run_code_unsafe'
  ) {
    const code = String(input.function ?? input.code ?? '');
    if (/\.submit\s*\(|requestSubmit\s*\(/i.test(code)) {
      deny('the script calls a form submit API.');
    }
    // Any scripted click bypasses the browser_click guard above, so block all
    // of them — the review gate exists precisely so nothing clicks on her behalf.
    if (/\.(?:click|dblclick)\s*\(/i.test(code)) {
      deny('the script performs a scripted click, which bypasses the review gate.');
    }
    // A scripted Enter/Return keypress can submit a focused form.
    if (/\.(?:press|down)\s*\(\s*[`'"](?:Enter|Return|NumpadEnter)\b/i.test(code)) {
      deny('the script presses Enter, which can submit a form.');
    }
  }

  process.exit(0);
});
