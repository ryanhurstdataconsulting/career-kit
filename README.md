# career-kit

A giftable job-search copilot: [career-ops](https://github.com/santifer/career-ops)
(MIT, scaffolded fresh at install time) plus a kit overlay that adds a guided
`/intake` interview, Simplify-Copilot-assisted applications driven over CDP into
a dedicated Chrome profile, a durable answer bank, and a code-enforced
never-submit gate. Built to be dropped into the Claude app's Code tab and driven
entirely by conversation.

This file is the maintainer's guide — architecture, how each load-bearing piece
works, the design rationale, and how to update and gift the kit.

## Who reads what

- **She (the recipient) reads** [`SETUP.md`](SETUP.md) — a warm, non-technical
  walkthrough of accounts and first run. Its content is not duplicated here;
  keep her guide in one place.
- **You (the maintainer) read** this file plus [`docs/`](docs/):
  [`docs/TEST-CHECKLIST.md`](docs/TEST-CHECKLIST.md) (live, human-in-the-loop
  verification), [`docs/UPDATING.md`](docs/UPDATING.md) (upstream-churn policy),
  [`docs/FALLBACKS.md`](docs/FALLBACKS.md) (manual paths and residual-risk
  notes), and [`docs/POE-VARIANT.md`](docs/POE-VARIANT.md) (optional Poe engine).

## Architecture — scaffold, then overlay

The kit never vendors or patches upstream. career-ops ships near-daily, so the
overlay stays strictly additive and the tracked repo holds only kit-authored
files. `setup.sh` (idempotent; safe to re-run) does the assembly:

1. **Preflight** — Node ≥ 20 with `git`, `rsync`, `npx`, and `curl` on PATH
   (macOS-targeted). A missing Node opens nodejs.org and exits with a friendly
   message.
2. **Scaffold** — `npx -y @santifer/career-ops init` into a `mktemp -d`, so the
   working tree is never itself a scaffolding target.
3. **Sync in** — `rsync -a` from the temp scaffold into the repo root, always
   excluding the kit's own control files (`README.md`, `CLAUDE.md`,
   `.gitignore`, `.git`), every upstream user-layer file by name (`cv.md`,
   `portals.yml`, `article-digest.md`, `config/profile.yml`,
   `config/portals.yml`, `modes/_profile.md`, `modes/_custom.md`), and the
   four personal-data trees as whole directories (`data/`, `output/`,
   `reports/`, `interview-prep/`) — in both modes. A plain (install/repair)
   run then seeds those four trees with `rsync -a --ignore-existing`, so a
   fresh install materializes whatever upstream ships there without ever
   overwriting an existing file; `--update` skips the seeding entirely.
4. **Preserve upstream docs** — upstream's `README.md` and `CLAUDE.md` are
   copied aside as `README.upstream.md` and `CLAUDE.upstream.md`; the kit's own
   `CLAUDE.md` bridges to them.
5. **Overlay** — `rsync -a overlay/ ./` (kit files, overwritten every run) then
   `rsync -a --ignore-existing seed/ ./` (user-owned starters, copied once and
   never clobbered).
6. **Dependencies** — `npm install`, then `npx playwright install chromium`
   (upstream's PDF renderer needs it).
7. **Stamp and check** — write the scaffolded version to `.career-ops-version`,
   then run both doctors: upstream `doctor.mjs` (informational pre-onboarding)
   and `apply/doctor.mjs --setup`.

The net effect: everything material — the upstream engine, `node_modules/`, and
all personal data — is untracked by construction (the whitelist `.gitignore`
below), so the repo you gift carries no personal data.

## Repo layout (tracked files only)

```
career-kit/
├── README.md                 # this file — the maintainer guide
├── SETUP.md                  # recipient-facing setup guide (accounts + first run)
├── setup.sh                  # idempotent installer: scaffold → overlay → deps → doctors
├── .gitignore                # whitelist: tracks ONLY the kit's own files
├── docs/                     # maintainer docs (each file whitelisted by name)
│   ├── TEST-CHECKLIST.md     # live, human-in-the-loop verification script
│   ├── UPDATING.md           # setup.sh --update semantics; upstream-churn policy
│   ├── FALLBACKS.md          # manual apply paths; browser_press_key residual-risk note
│   └── POE-VARIANT.md        # optional: run the interview on Poe (Claude-Fable-5)
├── overlay/                  # copied onto the workspace root every run (kit-owned)
│   ├── CLAUDE.md             # kit house rules; bridges to CLAUDE.upstream.md
│   ├── .mcp.json             # Playwright MCP → CDP at http://localhost:9223
│   ├── .claude/
│   │   ├── settings.json     # PreToolUse hook wiring the submit guard
│   │   └── skills/
│   │       ├── intake/SKILL.md   # /intake — the get-to-know-you interview
│   │       ├── apply/SKILL.md    # /apply — fill for review, never submit
│   │       └── jobs/SKILL.md     # /jobs — prioritized pipeline table
│   ├── apply/
│   │   ├── submit-guard.mjs   # PreToolUse hook; exit 2 blocks a submit-like action
│   │   ├── answers.mjs        # durable cross-application answer bank (data/answers.yml)
│   │   ├── queue.mjs          # standalone parser over data/applications.md (--next/--list)
│   │   ├── doctor.mjs         # apply-layer health checks (--setup skips the live probe)
│   │   └── launch-chrome.sh   # start the dedicated job-hunt Chrome on port 9223
│   ├── data/answers.example.yml  # documented answer-bank template (real file gitignored)
│   └── intake/README.md          # "drop your resume/LinkedIn PDF here" drop-zone note
└── seed/                     # user-owned starters: copied once (--ignore-existing)
    ├── modes/_custom.md              # apply/pdf-mode deltas upstream reads each run
    └── config/archetype-emphasis.md  # per-archetype CV emphasis; /intake fills it in
```

After `setup.sh` runs, the same folder also holds the materialized upstream
(`AGENTS.md`, `modes/`, the `*.mjs` scripts, `templates/`,
`.claude/skills/career-ops/`, `config/*.example.yml`, `README.upstream.md`,
`CLAUDE.upstream.md`), `node_modules/`, `.career-ops-version`, and — as she uses
it — her personal data (`config/profile.yml`, `cv.md`, `data/`, `output/`,
`reports/`). None of that is tracked; the whitelist `.gitignore` ignores
everything at the root (`/*`) and re-includes only the kit paths above.

## How the load-bearing pieces work

### The never-submit gate

`overlay/.claude/settings.json` registers one PreToolUse hook over
`browser_click`, `browser_type`, `browser_evaluate`, and
`browser_run_code_unsafe`, running `apply/submit-guard.mjs`. The guard reads the
tool call on stdin and **exits 2 to block** (feeding its stderr back to the
agent) when:

- a `browser_click` targets an element whose accessible name matches the submit
  denylist (`submit`, `send (my/your) application`,
  `finish`/`complete`/`confirm application`);
- a `browser_type` carries `submit: true` (the Enter-press variant);
- a `browser_evaluate` or `browser_run_code_unsafe` script calls `.submit()` /
  `requestSubmit()`, or clicks a submit-matching control.

There is no override flag — a block is the design working, not a bug. Two
deliberate non-blocks:

- **"Apply now" is allowed.** It typically *opens* an application rather than
  final-submitting one, so it is intentionally kept off the denylist.
- **`browser_press_key` is not hooked at all.** Native dropdowns and comboboxes
  need Enter to commit a selection, and hooking the key would break ordinary
  form filling. The residual risk (a stray Enter on a focused form) is
  documented in [`docs/FALLBACKS.md`](docs/FALLBACKS.md); upstream's
  instruction-level "never click Submit" rule stays as defense-in-depth.

### The Chrome bridge

`overlay/.mcp.json` points the Playwright MCP (`@playwright/mcp@latest`) at
`--cdp-endpoint http://localhost:9223`, and `apply/launch-chrome.sh` starts a
real Chrome with `--user-data-dir=~/.career-kit-chrome` and
`--remote-debugging-port=9223`. The reason for connecting over CDP rather than
letting the MCP launch its own browser: MCP-launched contexts do not load
extensions, and Simplify Copilot must stay installed and signed in. A dedicated,
persistent Chrome profile keeps the extension live and the session logged in,
fully isolated from her everyday Chrome.

### The answer bank

`apply/answers.mjs` maintains `data/answers.yml` — durable, cross-application
answers to recurring form questions (work authorization, sponsorship, salary,
EEO). This is net-new: upstream persists answers per report only, and its
profile schema has no EEO/demographic block. `--lookup` matches in three tiers
(exact normalized label → a declared `match` term contained in the query →
unambiguous substring, at least 8 characters each way); `--add` upserts an
entry; `--list` prints labels only unless `--full` is given, so answers never
leak into casual output. The file is gitignored (it can hold salary and EEO
answers); `data/answers.example.yml` is the tracked template.

### The queue

`apply/queue.mjs` is a standalone Markdown-table parser over upstream's
`data/applications.md`. It deliberately imports nothing from upstream, so an
upstream refactor cannot break the read path — it reads only the documented
table format. `--next` returns the highest-scoring `evaluated`,
not-yet-applied job with a `belowThreshold` flag against the 4.0 proceed
threshold; `--list` returns every row ordered by what needs her attention first
(offer → interview → responded → evaluated → applied → terminal states),
score-descending within each group. All tracker *writes* still go through
upstream `set-status.mjs`.

### The doctor

`apply/doctor.mjs` checks the apply layer: `js-yaml` present, the Chrome binary,
the dedicated profile and the Simplify extension (scanning extension manifests
and resolving `__MSG_` localized names), a live CDP probe on port 9223, that
`answers.yml` parses, and the Playwright Chromium cache. `--setup` skips the
live CDP probe, since Chrome is not expected to be up at install time. Hard
failures exit 1; warnings describe their own fix. Upstream `doctor.mjs` covers
the career-ops core.

### The three skills

- **`/intake`** wraps upstream onboarding: it reads a resume or LinkedIn PDF
  from `intake/` to confirm rather than re-ask, interviews one topic at a time,
  and writes the upstream-exact schemas (`config/profile.yml`, `cv.md`,
  `config/portals.yml`, `modes/_profile.md`) plus kit-owned
  `config/archetype-emphasis.md`, seeding the answer bank as it goes.
- **`/apply`** runs upstream `modes/apply.md` as the form engine, with kit
  deltas: the doctor gate, the `queue.mjs` pick, the tailored `output/cv-*.pdf`
  attach, answer-bank gap fill, the exact review-gate wording, and a status
  update only on her spoken confirmation via `set-status.mjs`.
- **`/jobs`** renders `queue.mjs --list` as a prioritized, skimmable table.

### The seeds

`seed/` holds two user-owned starters, copied once with `--ignore-existing` so
her edits survive every re-run and every `--update`: `modes/_custom.md` (the
apply- and pdf-mode deltas upstream reads on each run) and
`config/archetype-emphasis.md` (per-archetype CV emphasis, filled in during
`/intake`). Once copied, both files belong to her.

## Design decisions

| Decision | Why |
|---|---|
| Scaffold-then-overlay; never patch upstream | career-ops ships near-daily; an additive overlay survives the churn, and the tracked repo stays kit-only. |
| Reuse upstream's `apply` mode as the form engine | Recon of v1.18.0 found a mature apply mode (knock-out pre-scan, preflight liveness/duplicate gate, per-ATS quirks) already driven by the Playwright MCP — a net-new `driver.mjs`/`ats-map.mjs` would only duplicate it. |
| Never-submit as a PreToolUse hook, not driver code | With the form engine now upstream plus the MCP rather than our own code, enforcement moves to the tool boundary — code-enforced, no override, with upstream's instruction rule as defense-in-depth. |
| Bridge to a real Chrome over CDP (`.mcp.json`) | MCP-launched contexts do not load extensions; Simplify must stay installed and signed in, so the kit connects to a dedicated, persistent Chrome instead of letting the MCP spawn its own. |
| Durable answer bank (`answers.mjs`) | Upstream persists answers per report only, and its profile schema has no EEO/demographic block; recurring salary and EEO answers need a cross-application home. |
| Standalone `queue.mjs` (no upstream imports) | A self-contained table parser cannot be broken by an upstream refactor; writes still route through upstream `set-status.mjs`. |
| No `apply/package.json` | Kit scripts import `js-yaml` from the workspace-root `node_modules` (upstream already depends on `js-yaml` and `playwright`) — one dependency tree, not two. |
| Whitelist `.gitignore` | Tracking only kit-authored files means the gift carries no personal data by construction; every materialized or personal file stays untracked. |
| Seeds via `rsync --ignore-existing` | User-owned starter files are copied once and never clobbered, so her edits survive re-runs and updates. |

## Test evidence (build verification, 2026-07-07)

Automated, run in a clean copy:

- **setup.sh end-to-end** — full scaffold → overlay → deps → doctors, exit 0.
- **submit-guard** — 20/20 unit cases (each denylist phrase blocked, each safe
  control allowed).
- **Workspace layering** — 25/25 path checks (the right files tracked, the right
  files excluded).
- **answers.mjs** — 8/8 lookup/add round-trip cases.
- **queue.mjs** — full fixture suite (parsing, ordering, `--next` threshold).
- **doctor** — both modes (`--setup` and the full everyday check).
- **Idempotency** — a plain re-run and an `--update` both leave all 8 planted
  user-layer files checksum-identical; the seeds' user edits survive;
  `.career-ops-version` records v1.18.0; both doctors report green.

Live checks that still need a human — Simplify signup and real application dry
runs on Greenhouse, Lever, and Workday — live in
[`docs/TEST-CHECKLIST.md`](docs/TEST-CHECKLIST.md).

## Updating

`./setup.sh --update` re-scaffolds the latest career-ops and rsyncs only code
paths in — the personal-data trees (`data/`, `output/`, `reports/`,
`interview-prep/`) and the by-name user-layer files are excluded in every mode,
and `--update` additionally skips the install-only seeding pass, so it writes
nothing inside those trees at all. It then re-stamps `.career-ops-version` and
re-runs both doctors — her profile and history are untouched. Always run an
`--update` on your own Mac before she does; full policy is in
[`docs/UPDATING.md`](docs/UPDATING.md).

## Gifting

The tracked repo contains no personal data by construction, so either path is
safe:

- **Private GitHub repo (preferred — enables updates):**
  `gh repo create career-kit --private --source=. --push`, then add her as a
  collaborator or send her the link. She clones and follows `SETUP.md`.
- **Zip / AirDrop:** export just the tracked (kit-only) files with
  `git archive -o career-kit.zip HEAD` — or zip the folder minus `.git/`,
  `node_modules/`, and any personal data — then AirDrop it. She unzips and
  follows `SETUP.md`.

Either way she opens the folder in the Claude app's Code tab and runs
`./setup.sh` (or lets Claude run it on first open).
</content>
</invoke>
