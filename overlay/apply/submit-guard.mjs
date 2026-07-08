#!/usr/bin/env node
// career-kit submit guard — a Claude Code PreToolUse hook.
//
// Blocks any Playwright-MCP action that could submit a job application. The
// human always reviews the filled form and clicks Submit herself. There is
// deliberately no override flag: a blocked call here is the system working.
//
// Wired in .claude/settings.json for: browser_click, browser_type,
// browser_evaluate, browser_run_code_unsafe. Exit code 2 blocks the call and
// feeds stderr back to the agent.

const SUBMIT_RE =
  /\bsubmit\b|\bsend\s+(my\s+|your\s+)?application\b|\bfinish\s+application\b|\bcomplete\s+application\b|\bconfirm\s+application\b/i;

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
      deny(`the target element ("${label}") looks like a submit control.`);
    }
  }

  if (tool === 'mcp__playwright__browser_type' && input.submit === true) {
    deny('typing with submit: true presses Enter, which can submit a form.');
  }

  if (
    tool === 'mcp__playwright__browser_evaluate' ||
    tool === 'mcp__playwright__browser_run_code_unsafe'
  ) {
    const code = String(input.function ?? input.code ?? '');
    if (/\.submit\s*\(|requestSubmit\s*\(/i.test(code)) {
      deny('the script calls a form submit API.');
    }
    if (/\.click\s*\(/i.test(code) && SUBMIT_RE.test(code)) {
      deny('the script clicks something that looks like a submit control.');
    }
  }

  process.exit(0);
});
