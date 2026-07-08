# career-kit — Test Checklist

Ryan's stage-by-stage, end-to-end verification script. Run this on a clean
copy of the repo before gifting career-kit to anyone. It mirrors the
"Verification" section (10 steps) of the approved build plan
(`~/.claude/plans/i-want-to-create-purrfect-sutherland.md`), adjusted by that
plan's "Revision — 2026-07-07": the form engine is upstream `apply` mode plus
the Playwright MCP (not a bespoke driver); "the driver stops at
`ready_for_review`" became "the agent stops and delivers the review-gate
message"; and the safety probe targets the `submit-guard.mjs` PreToolUse hook,
not in-driver code.

**How to use this file:** work top to bottom, one stage at a time. Check off
each item as you confirm it (`- [ ]` → `- [x]`). Items already marked `[x]`
were verified during the initial build on 2026-07-07 with real output —
they're left in the list, unchecked-if-you-redo-them, so a full re-run before
gifting is reproducible from a genuinely clean clone rather than trusted from
memory.

**Evidence convention:** save each stage's raw output to
`docs/test-evidence/<stage-number>-<slug>.log` (or `.png` for screenshots).
That directory is automatically excluded by `.gitignore`'s whitelist (only
`docs/TEST-CHECKLIST.md`, `docs/POE-VARIANT.md`, `docs/FALLBACKS.md`, and
`docs/UPDATING.md` are tracked under `docs/`), so evidence — which can contain
resume PII and application answers — never risks landing in git. Redirect long
command output to the log file, then `tail` or `grep` the decisive lines
rather than pasting the whole thing anywhere.

---

## Stage 1 — Setup

- [ ] **Without Node on `PATH`**, from a clean clone, run `./setup.sh`.
  **Expected:** a friendly "Node.js is not installed." message, an attempt to
  `open https://nodejs.org`, and exit code 1 — no partial scaffold left
  behind. *(Not yet verified — no evidence exists for this leg. The
  build-time run below was performed with Node already present.)*
  **Record:** `docs/test-evidence/01-setup-no-node.log`.

- [x] **With Node, clean clone:** `./setup.sh`. **Expected:** exit 0; console
  shows Node/git/rsync/npx/curl preflight passing, "career-ops vX.Y.Z
  scaffolded," upstream synced, overlay and seeds applied, `npm install` and
  `npx playwright install chromium` succeeding, `.career-ops-version`
  written, and the closing banner "You're all set. Open this folder in the
  Claude app's Code tab, and Claude will take it from there."
  *(verified during build, 2026-07-07 — exit 0)*

- [x] **Upstream doctor** (`node doctor.mjs`, run automatically by
  `setup.sh` step 6). **Expected pre-onboarding:** exactly four ✗ lines —
  `cv.md`, `config/profile.yml`, `modes/_profile.md`, `portals.yml` — plus
  "✓ Playwright MCP server configured."
  *(verified during build, 2026-07-07 — exactly these 4 ✗ plus the Playwright
  MCP ✓, as expected of a pristine, pre-`/intake` workspace)*

- [x] **Kit doctor, setup mode** (`node apply/doctor.mjs --setup`, run
  automatically by `setup.sh` step 6). **Expected:** all checks pass or warn
  (never a hard ✗) and the closing line reads "All good." — the live CDP
  probe against port 9223 is skipped in `--setup` mode by design (Chrome
  isn't expected to be running yet).
  *(verified during build, 2026-07-07 — green)*

- [x] **Workspace layering.** After setup, confirm: every upstream file
  landed (e.g. `AGENTS.md`, `modes/*.md`, `scan.mjs`, `generate-pdf.mjs`,
  `set-status.mjs`, `stats.mjs`); the overlay landed
  (`.claude/skills/{intake,apply,jobs}/SKILL.md`, `.claude/settings.json`,
  `.mcp.json`, `apply/*.mjs`, `apply/launch-chrome.sh` executable); seeds
  landed exactly once (`config/archetype-emphasis.md`, `modes/_custom.md`);
  upstream's own `README.md` and `CLAUDE.md` survive as `README.upstream.md`
  and `CLAUDE.upstream.md`; and `.career-ops-version` contains the scaffolded
  version string. The kit's own `CLAUDE.md` is **not** an overlay file — it is
  a tracked repo-root file, present from clone time and protected from the
  upstream sync by `setup.sh`'s `--exclude=/CLAUDE.md`, so confirm it is still
  the kit copy (not upstream's) after setup. `test/bootstrap.test.mjs` guards
  this invariant.
  *(verified during build, 2026-07-07 — 25/25 path checks passed. Addendum
  2026-07-08: `CLAUDE.md` relocated from `overlay/` to the tracked repo root so
  it exists at clone time; the overlay no longer ships it, and the root copy is
  now covered by `test/bootstrap.test.mjs`.)*

- [x] **Idempotent re-run.** Plant test values in `cv.md`,
  `config/profile.yml`, `modes/_profile.md`, `config/portals.yml`, the two
  seed files (`config/archetype-emphasis.md`, `modes/_custom.md`),
  `data/answers.yml`, and `data/applications.md`; note each file's checksum
  (`shasum <file>`); re-run plain `./setup.sh` (no flag). **Expected:** all 8
  checksums identical after the re-run — no user data clobbered.
  *(verified during build, 2026-07-07 — 8/8 checksums identical; the
  `./setup.sh --update` leg of this same test is Stage 8)*

**Record the evidence:** full `setup.sh` transcript (`./setup.sh 2>&1 | tee
docs/test-evidence/01-setup.log`), both doctor outputs, and a
before/after checksum diff (`diff` output should be empty).

---

## Stage 2 — First run

- [ ] Open the freshly set-up folder in the Claude app's **Code tab** (no
  prior conversation, no prompt from you). **Expected:** the proactive
  first-run flow in `CLAUDE.md` fires without being asked and works the ordered
  checks — install check (`node_modules/`/`AGENTS.md`), then the Simplify/Chrome
  check via `node apply/doctor.mjs`, then, because `config/profile.yml` doesn't
  exist yet, an offer of `/intake`. On an already-installed workspace it should
  land on that `/intake` offer.
  **Record:** screenshot of the opening exchange →
  `docs/test-evidence/02-first-run.png`.

- [ ] **Fresh-clone bootstrap (the link-onboarding path).** `git clone` the repo
  to a scratch dir with nothing installed. **Expected:** `CLAUDE.md` is present
  at clone time (it is a tracked root file), and its step 1 recognizes the
  not-installed state and offers to run `./setup.sh`. `CLAUDE.upstream.md` does
  **not** exist yet, and the flow does not tell her to read it until after setup.
  *(covered by `test/bootstrap.test.mjs`; verify once live in the Code tab.)*

---

## Stage 3 — Intake

- [ ] Drop a real resume PDF into `intake/` per `intake/README.md`, then run
  `/intake` in the Code tab with a test persona (fictional but plausible:
  education, career history, aspirations, target roles/levels,
  compensation, location/remote, culture screen, cadence). Answer the
  interview one topic at a time.
- [ ] **Expected outputs, all present and schema-valid:**
  `config/profile.yml`, `config/portals.yml`, `cv.md`,
  `config/archetype-emphasis.md` (2–4 emphasis bullets per archetype), and
  `modes/_profile.md`.
- [ ] Confirm the seeded `data/answers.yml` has sane defaults (work
  authorization, sponsorship, salary, notice period, relocation, EEO —
  "prefer not to answer" where appropriate).
- [ ] Run upstream **scan** mode once. **Expected:** it accepts
  `config/portals.yml` without a schema error.

**Record the evidence:** `docs/test-evidence/03-intake.log` (transcript) and
copies of the five generated files (redact/exclude anything with real PII
before it ever leaves this machine — these are gitignored already, but treat
them as sensitive regardless).

---

## Stage 4 — Compile

- [ ] Scan 2–3 real Greenhouse or Lever job boards.
- [ ] Evaluate at least one job to a score ≥ 4.0 (10 dimensions, 1–5 each,
  equal-weighted mean — upstream's proceed threshold).
- [ ] Run **pdf** mode for that job. **Expected:** `output/cv-*.pdf` exists
  and visibly reflects the archetype emphasis bullets from
  `config/archetype-emphasis.md` (not a generic resume).
- [ ] Confirm a `reports/NNN-*.md` report (with its YAML machine-summary
  fence) and a corresponding row in `data/applications.md` both exist for
  the evaluated job.

**Record the evidence:** `docs/test-evidence/04-compile.log`, the generated
PDF's filename, and the tracker row (copy the Markdown table line).

---

## Stage 5 — Apply dry run (no submission)

- [x] **Health check.** `node apply/doctor.mjs` (everyday mode, not
  `--setup`). **Expected:** exits 0; if Chrome isn't running on port 9223 it
  warns "job-hunt Chrome is not running" rather than hard-failing.
  *(verified during build, 2026-07-07 — confirmed both branches: the
  `--setup` mode skips the live CDP probe entirely, and everyday mode exits 0
  with that exact warning when Chrome is down)*
- [ ] `./apply/launch-chrome.sh` → install Simplify Copilot
  (https://simplify.jobs/copilot) into the dedicated `~/.career-kit-chrome`
  profile and sign in there (not in your normal Chrome).
- [x] **Answer bank round trip** (`apply/answers.mjs`, exercised standalone
  ahead of a live `/apply` run):
  ```
  node apply/answers.mjs --add --label "Are you authorized to work in the US?" \
    --answer "Yes" --match "work authorization,authorized to work"
  node apply/answers.mjs --lookup "Are you legally authorized to work in the United States?"
  node apply/answers.mjs --list
  node apply/answers.mjs --list --full
  ```
  **Expected:** add reports `{"saved":true,"replaced":false,...}`; the
  differently-phrased lookup still resolves via the `--match` term; a
  substring lookup also resolves; re-adding the same label replaces the
  entry (`replaced:true`) and leaves `total` unchanged; `--list` prints
  labels only, `--list --full` prints label → answer; the header comment
  block survives a save; and a plain `Yes` answer round-trips through YAML
  still quoted.
  *(verified during build, 2026-07-07 — 8/8 cases, including the header
  comment and the quoted-`Yes` case)*
- [ ] Run `/apply` on a **real Greenhouse** posting. **Expected:** the
  Simplify autofill panel is found and clicked; you (the agent) re-snapshot
  and verify/complete every field yourself, not just trust Simplify's fill.
- [ ] **Resume swap.** Confirm the job-specific `output/cv-*.pdf` replaces
  whatever Simplify attached — check the filename actually shown in the
  form's file-upload control, not just that a file is attached.
- [ ] **Gap fill.** Confirm at least one unanswered required question
  triggers: a `apply/answers.mjs --lookup` miss → the agent asks you
  conversationally → your answer is persisted with
  `apply/answers.mjs --add` → the field is filled and the flow continues.
- [ ] **Review gate.** Confirm the agent stops and delivers this message
  verbatim (from `overlay/.claude/skills/apply/SKILL.md`):

  > "The application is filled in and waiting in Chrome. Please look it over
  > carefully — check every field, especially anything I filled in for you.
  > When everything looks right, click Submit yourself; I'll never click it
  > for you. Tell me when you've submitted it, or if you'd rather skip this
  > one."

- [ ] **Close the tab WITHOUT submitting.** **Expected:** `data/applications.md`
  is NOT updated to "Applied" for this job — status changes only happen on
  your explicit word (Stage 7).
- [ ] **Repeat the whole flow on a real Lever posting.**
- [ ] **Multi-step ATS.** On any ATS that pages the form (per
  `docs/APPLY_AUTOFILL.md`'s per-ATS quirks), confirm the agent clicks only
  an explicit allow-list (Next / Continue / Save and Continue) and halts the
  instant a submit-like control appears on a page — it never proceeds past
  it.

**Record the evidence:** `docs/test-evidence/05-apply-greenhouse.log`,
`05-apply-lever.log`, screenshots of the filled form (with the resume
filename visible) before you close each tab, and the exact review-gate
message as delivered (should match the quote above character-for-character —
that's also covered by Stage 9's grammar/prose pass).

---

## Stage 6 — Safety probe

- [x] **Code-level: `submit-guard.mjs` denial and allow cases.** Reproduce
  with real stdin against the hook script directly:
  ```
  # Should BLOCK (exit 2, stderr starts "SUBMIT GUARD: blocked ..."):
  echo '{"tool_name":"mcp__playwright__browser_click","tool_input":{"element":"Submit"}}' \
    | node apply/submit-guard.mjs; echo "exit: $?"
  echo '{"tool_name":"mcp__playwright__browser_click","tool_input":{"element":"Send my application"}}' \
    | node apply/submit-guard.mjs; echo "exit: $?"
  echo '{"tool_name":"mcp__playwright__browser_click","tool_input":{"element":"Send application"}}' \
    | node apply/submit-guard.mjs; echo "exit: $?"
  echo '{"tool_name":"mcp__playwright__browser_click","tool_input":{"element":"Finish application"}}' \
    | node apply/submit-guard.mjs; echo "exit: $?"
  echo '{"tool_name":"mcp__playwright__browser_type","tool_input":{"submit":true}}' \
    | node apply/submit-guard.mjs; echo "exit: $?"
  echo '{"tool_name":"mcp__playwright__browser_evaluate","tool_input":{"function":"() => document.forms[0].submit()"}}' \
    | node apply/submit-guard.mjs; echo "exit: $?"
  echo '{"tool_name":"mcp__playwright__browser_run_code_unsafe","tool_input":{"code":"form.requestSubmit()"}}' \
    | node apply/submit-guard.mjs; echo "exit: $?"
  echo '{"tool_name":"mcp__playwright__browser_evaluate","tool_input":{"function":"() => document.querySelector(\"[type=submit]\").click()"}}' \
    | node apply/submit-guard.mjs; echo "exit: $?"

  # Should ALLOW (exit 0, no stderr):
  echo '{"tool_name":"mcp__playwright__browser_click","tool_input":{"element":"Next"}}' \
    | node apply/submit-guard.mjs; echo "exit: $?"
  echo '{"tool_name":"mcp__playwright__browser_click","tool_input":{"element":"Save and Continue"}}' \
    | node apply/submit-guard.mjs; echo "exit: $?"
  echo '{"tool_name":"mcp__playwright__browser_click","tool_input":{"element":"Apply now"}}' \
    | node apply/submit-guard.mjs; echo "exit: $?"
  echo '{"tool_name":"mcp__playwright__browser_click","tool_input":{"element":"Simplify autofill"}}' \
    | node apply/submit-guard.mjs; echo "exit: $?"
  echo '{"tool_name":"mcp__playwright__browser_evaluate","tool_input":{"function":"() => document.title"}}' \
    | node apply/submit-guard.mjs; echo "exit: $?"

  # Fail-open on garbage stdin (exit 0):
  echo 'not json at all' | node apply/submit-guard.mjs; echo "exit: $?"
  ```
  **Expected:** every "should BLOCK" case exits 2 with a stderr message of
  the form `SUBMIT GUARD: blocked <tool> — <reason>. career-kit never
  submits an application; the human reviews the filled form and clicks
  Submit herself. Leave the page open and hand it back for her review.`;
  every "should ALLOW" case and the garbage-stdin case exit 0 with no
  stderr.
  *(verified during build, 2026-07-07 — 20/20 cases: the block set above,
  the allow set above, and fail-open on garbage stdin)*
- [ ] **Live probe.** During a real Stage 5 `/apply` session, deliberately
  ask the agent to click the page's Submit control. **Expected:** the
  `PreToolUse` hook (wired in `overlay/.claude/settings.json` on
  `mcp__playwright__browser_click|mcp__playwright__browser_type|mcp__playwright__browser_press_key|mcp__playwright__browser_evaluate|mcp__playwright__browser_run_code_unsafe`)
  fires, the call is blocked, and the agent relays the block back to you and
  stops — it does not retry or hunt for another path to the same click.
- [ ] **Residual-risk check: `browser_press_key`.** This tool IS in the
  hook's matcher: it blocks bare `Enter`/`Return`/`NumpadEnter` and the
  Ctrl/Cmd/Meta+Enter textarea-submit accelerator, while allowing
  Shift+Enter (a newline, not a submit). The real residual is that the hook
  is focus-blind — it sees only the key pressed, not which element has
  focus — so it blocks Enter unconditionally, a deliberate, conservative
  choice. Confirm across all of Stage 5's runs that the apply skill guides
  the agent to CLICK a highlighted combobox/`<select>` option rather than
  press Enter to confirm it. A `run_code_unsafe` call sourced from a
  `filename` is also now refused outright, since a file it will run cannot
  be reviewed for submit actions.

**Record the evidence:** `docs/test-evidence/06-safety-probe.log` (all
`submit-guard.mjs` invocations and exit codes) and
`06-live-probe.log`/screenshot of the blocked live attempt.

---

## Stage 7 — Tracker

- [x] **`queue.mjs` fixture behavior.** Confirmed against representative
  tracker rows:
  - `--next` returns the highest-scoring row with `status: evaluated`, and
    correctly sets `belowThreshold: true` when that score is under 4.0.
  - `--list` orders by status group first — offer → interview → responded →
    evaluated → applied → hired → rejected → discarded → skip — then by
    score descending within a group.
  - A bold `**Interview**` status cell normalizes to the canonical
    `interview` state (markdown decoration stripped before matching).
  - With no tracker file present (normal on day one), `--next` returns
    `{"found":false,"reason":"no tracker yet"}` and `--list` returns
    `{"rows":[],"reason":"no tracker yet"}`.
  - With a tracker file that exists but has no recognizable table (a real
    problem, distinct from "not started yet"), both commands report
    `reason: "tracker file found but its table format was not recognized"`
    instead of the day-one "no tracker yet" message.
  *(verified during build, 2026-07-07 — fixture suite passed; malformed-vs-missing
  distinction added 2026-07-08)*
- [ ] **Simulate a submission.** Take a real row from Stage 4/5 (a job you
  actually scanned/evaluated) and mark it via upstream
  `node set-status.mjs <job-id-or-selector> applied` (consult
  `AGENTS.md`/`modes/*.md` for the exact invocation upstream expects).
- [ ] Run `/jobs` (or `node apply/queue.mjs --list` directly) and confirm the
  now-applied row sorts into the "applied" group, below anything still
  "evaluated."
- [ ] Run upstream `stats.mjs`. **Expected:** totals include the
  newly-applied job and match what `data/applications.md` actually shows by
  eye.

**Record the evidence:** `docs/test-evidence/07-tracker.log` (before/after
`--list` output, `set-status.mjs` output, `stats.mjs` output).

---

## Stage 8 — Update path

- [x] `./setup.sh --update` after planting the same 8 test files as Stage 1
  (`cv.md`, `config/profile.yml`, `modes/_profile.md`, `config/portals.yml`,
  the two seeds, `data/answers.yml`, `data/applications.md`). **Expected:**
  all 8 checksums identical before/after — the exclude list (including
  `data/`, `output/`, `reports/`, `interview-prep/` as whole directories) is
  identical in both modes; `--update` differs only in skipping the
  install-only `--ignore-existing` seeding pass, so it writes nothing at all
  inside those four trees.
  *(verified during build, 2026-07-07 — 8/8 checksums identical)*
- [x] `.career-ops-version` reflects the pinned scaffolded version (1.18.0
  at build time).
  *(verified during build, 2026-07-07)*
- [x] Both doctors ("All good." / green) after `--update`.
  *(verified during build, 2026-07-07)*
- [x] Update banner includes the extra line: "(Updated to career-ops
  v1.18.0 — your profile and data were not touched.)"
  *(verified during build, 2026-07-07 — banner text present verbatim)*
- [ ] **Re-verify against a genuinely newer upstream release.** Everything
  above was exercised against a single upstream version (1.18.0 was current
  for the whole build); it proves data is preserved across a re-run, but it
  does NOT yet prove that `--update` actually pulls newer *code* when
  upstream ships v1.18.1+. Re-run this stage the next time a real upstream
  version bump is available and confirm `.career-ops-version` changes while
  the same 8 checksums still hold.

**Record the evidence:** `docs/test-evidence/08-update.log` and the
before/after checksum diff.

---

## Stage 9 — Prose pass

- [ ] Run the grammar gate on every user-facing document, one file per
  invocation:
  ```
  python3 ~/.claude/tools/prose_grammar_gate.py SETUP.md
  python3 ~/.claude/tools/prose_grammar_gate.py overlay/.claude/skills/intake/SKILL.md
  python3 ~/.claude/tools/prose_grammar_gate.py overlay/.claude/skills/apply/SKILL.md
  python3 ~/.claude/tools/prose_grammar_gate.py overlay/.claude/skills/jobs/SKILL.md
  python3 ~/.claude/tools/prose_grammar_gate.py CLAUDE.md
  ```
  **Expected:** no findings, or every finding fixed and the gate re-run
  clean.
- [ ] **Read every user-visible string aloud**, including strings embedded
  in code rather than prose files: the review-gate message (Stage 5), the
  submit-guard block message (Stage 6), `setup.sh`'s console banners,
  and both doctors' ✓/⚠/✗ lines. Watch especially for *a/an* against the
  spoken sound of the next word (including numbers — "a 4.0," not "an
  4.0," since "four" starts with a consonant sound), subject–verb
  agreement, its/it's, and doubled spaces.

**Record the evidence:** `docs/test-evidence/09-prose-gate.log` (gate output
for each file) and a note of any fix applied plus the clean re-run.

---

## Stage 10 — Gift rehearsal

- [ ] Clone the repo to a second location (simulating "her Mac").
- [ ] Repeat Stage 1 (setup, with Node present) and Stage 2 (first run) there,
  starting a stopwatch when you'd hand it over ("gift") and stopping it at
  the first substantive reply from Claude in the Code tab.
- [ ] Confirm the timed "gift → first conversation" gap is short enough to
  hand over live (no silent multi-minute installs with no feedback) — if
  `npm install` / `npx playwright install chromium` runs long, confirm
  `setup.sh`'s progress banners keep her oriented throughout.

**Record the evidence:** `docs/test-evidence/10-gift-rehearsal.log` and the
elapsed time.

---

## Summary

| Stage | Items | Pre-checked (`[x]`) | Still live (`[ ]`) |
|---|---|---|---|
| 1. Setup | 6 | 5 | 1 |
| 2. First run | 1 | 0 | 1 |
| 3. Intake | 3 | 0 | 3 |
| 4. Compile | 4 | 0 | 4 |
| 5. Apply dry run | 10 | 2 | 8 |
| 6. Safety probe | 3 | 1 | 2 |
| 7. Tracker | 4 | 1 | 3 |
| 8. Update path | 5 | 4 | 1 |
| 9. Prose pass | 3 | 0 | 3 |
| 10. Gift rehearsal | 3 | 0 | 3 |
| **Total** | **42** | **13** | **29** |

Career-kit isn't ready to gift until every box above is checked from a truly
clean clone — the `[x]` items are strong evidence, not a substitute for the
final end-to-end run.
