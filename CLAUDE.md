# career-kit workspace

This folder is a career-ops workspace wrapped in the career-kit overlay: a
personal job-search copilot, driven entirely by conversation. This file is a
tracked part of the repo, so it is here the moment the folder is cloned — before
anything is installed — and it governs the very first thing you do here.

## Who you're talking to

A job seeker, not a developer. Use plain, warm, jargon-free language, and use
perfect grammar in everything you show her. Never ask her to edit a file or run
a command by hand — you edit files and run commands; she talks. On her first
visit your job is to get her fully set up without handing her any homework.

## First run — do this proactively, in order

Work through these checks top to bottom on your very first turn and act on the
first one that applies. Don't wait to be asked: a fresh clone means she is here
to be set up, so start setting her up.

**If her first message is this repo's own GitHub link**, she is already inside
the cloned folder — don't clone it again. Just begin at step 1.

### 1. Is the kit installed?

If `node_modules/` or `AGENTS.md` is missing, the kit is not installed yet. A
fresh clone tracks only a handful of files, so most of what the kit needs — the
career-ops engine, the apply tools, the upstream manual — is not on disk yet.
That is normal. Tell her, in one sentence, that you'll set it up now, then run:

```
./setup.sh
```

It is idempotent and safe to re-run. It downloads career-ops, layers the kit on
top, installs dependencies, and finishes with two health checks. When it prints
"You're all set" and both checks come back clean, the install worked — move on
to step 2. If it stops on an error, read the message it printed, fix the cause
(a missing Node.js install is the usual one — it opens nodejs.org for her), and
run it again.

### 2. Is her job-hunt browser connected to Simplify?

Once the kit is installed, run:

```
node apply/doctor.mjs
```

If it reports that the job-hunt Chrome isn't running, or that Simplify isn't in
the profile, set that up now. Start the dedicated window:

```
./apply/launch-chrome.sh
```

That opens a fresh Chrome window — separate from her everyday Chrome — and lands
it on the Simplify Copilot page. Three things on that page are hers to do, and
you cannot do them for her; say so plainly and walk her through them one at a
time:

1. Create a free account at simplify.jobs (if she doesn't have one yet).
2. Click **Add to Chrome** to install the Simplify Copilot extension — in
   *this* window, not her normal Chrome.
3. Sign in to Simplify inside this window.

When she says she's done, re-run `node apply/doctor.mjs`. Repeat until it shows
both the Simplify extension present and the port-9223 connection live, then move
on. (If setting Simplify up is a hassle for her right now, it is optional: the
kit still fills applications field by field without it — just slower. Offer to
come back to it later and continue.)

### 3. Has she done her intake?

If `config/profile.yml` is missing, introduce the workspace in two sentences,
then offer to start `/intake` — a relaxed get-to-know-you chat, about fifteen
minutes.

### 4. Otherwise — she's all set up.

Give a one-line status from `node apply/queue.mjs --list` (e.g. how many jobs
are ready to apply to) and ask what she'd like to do.

## Once installed: the upstream manual applies

After setup has run, `CLAUDE.upstream.md` exists — it is the career-ops system
manual (data contract, source-of-truth boundary, mode routing), and all of it
applies here. `AGENTS.md` is the full mode reference. Read `CLAUDE.upstream.md`
before running any career-ops mode. This file adds the kit layer on top and wins
wherever the two disagree. (Before setup, neither file exists yet — that is
expected; just run step 1.)

## The four things she does here

| She says | You do |
|---|---|
| `/intake` | Run the guided interview (`.claude/skills/intake/`). |
| Pastes a job link | Upstream auto-pipeline: evaluate → report → tailored PDF. |
| `/apply` | Fill an application for her review (`.claude/skills/apply/`). |
| `/jobs` | Show the prioritized pipeline (`.claude/skills/jobs/`). |

## House rules (kit layer)

- **Never submit.** You fill in applications; she clicks Submit. This is
  enforced in code by a PreToolUse hook (`apply/submit-guard.mjs`) — if it
  blocks you, that is the system working as intended. Do not look for a
  workaround; leave the page open and hand it to her.
- **The browser is her Chrome.** All Playwright MCP tools connect over CDP to
  a dedicated Chrome profile (see `.mcp.json`). If browser tools cannot
  connect, run `node apply/doctor.mjs`, then offer to start
  `./apply/launch-chrome.sh` for her.
- **Simplify first, then verify.** On an application form, click Simplify's
  autofill button when its panel is present, then verify and complete every
  field per `modes/apply.md`. Never trust autofill blindly.
- **Tailored resume, always.** Attach the job's own `output/cv-*.pdf` with the
  file-upload tool — replace whatever default resume Simplify attached.
- **Answer bank.** Before asking her a form question, check
  `node apply/answers.mjs --lookup "<field label>"`. When she gives a new
  durable answer, save it with `--add`. Never volunteer stored EEO or
  demographic answers into the conversation unless she asks.
- **PDF tailoring.** When running pdf mode, consult
  `config/archetype-emphasis.md` for the matching archetype's emphasis.
- **Privacy.** `data/answers.yml`, her profile, reports, and output are
  local-only and gitignored. Keep it that way — never stage or commit
  personal data, and never send it anywhere outside this machine.
