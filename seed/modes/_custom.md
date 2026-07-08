# Custom house rules (career-kit)

<!-- Seeded once by career-kit's setup.sh; this file is yours and survives updates. -->
<!-- Upstream modes read this file on every run (see CLAUDE.upstream.md). -->

## apply mode — kit deltas

1. **Dedicated browser.** Playwright MCP connects to the job-hunt Chrome
   profile over CDP (port 9223). If browser tools can't connect, run
   `node apply/doctor.mjs`, then offer to start `./apply/launch-chrome.sh`.
2. **Simplify first.** Once the form page has loaded, click the Simplify
   Copilot autofill button if its panel is present; wait for it to finish;
   re-snapshot; then verify and complete every field per `modes/apply.md`.
3. **Tailored resume.** Always upload this job's own `output/cv-*.pdf` into
   the resume field, replacing anything Simplify attached.
4. **Unknown required fields.** Check
   `node apply/answers.mjs --lookup "<field label>"` first; ask only on a
   miss; persist durable new answers with `--add`.
5. **Never submit.** The rule is enforced by a PreToolUse hook
   (`apply/submit-guard.mjs`). A blocked click is the system working — stop
   and hand the page to her.

## pdf mode — kit delta

Consult `config/archetype-emphasis.md` and weave the matching archetype's
emphasis bullets into the tailored CV's summary and highlights.
