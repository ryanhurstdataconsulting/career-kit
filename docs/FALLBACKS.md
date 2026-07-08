# FALLBACKS — when things go sideways

This is the "something broke" reference for career-kit's apply flow. It is written
mainly for Ryan, but plainly enough that the agent can read a passage straight to
her when it needs to explain what is happening.

## How the apply flow fits together (30-second refresher)

1. `apply/launch-chrome.sh` starts her real Google Chrome on a dedicated profile
   (`~/.career-kit-chrome`) with `--remote-debugging-port=9223`.
2. The Playwright MCP server (`overlay/.mcp.json`: `@playwright/mcp` with
   `--cdp-endpoint http://localhost:9223`) drives that Chrome window.
3. The Simplify Copilot extension — installed from the Chrome Web Store **inside
   that window** and signed in to her free simplify.jobs account — autofills the
   ATS form.
4. The agent verifies and completes fields per upstream `modes/apply.md`, uploads
   the tailored `output/cv-*.pdf`, and fills gaps from the answer bank
   (`apply/answers.mjs` over `data/answers.yml`).
5. The agent then **stops for her to review and click Submit herself.** A
   PreToolUse hook (`apply/submit-guard.mjs`) code-blocks any submit-like action.

Connecting over CDP to her real Chrome is required because an MCP-launched
persistent context does **not** load extensions — so Simplify would never appear.
That is why the flow always starts by launching Chrome separately.

The single best first move for almost any breakage below is:

```
node apply/doctor.mjs
```

It checks, in order: npm dependencies, the Chrome binary, the dedicated profile
and whether Simplify is installed in it, the live port-9223 connection, that
`data/answers.yml` parses, and that the PDF renderer is present. It exits `1`
only on a hard failure; a `⚠` warning explains how to fix itself.

---

## 1. Chrome or CDP will not connect

**Symptoms**
- Playwright browser tools report they cannot connect, or the agent says the
  browser is not reachable.
- `node apply/doctor.mjs` prints `⚠ job-hunt Chrome is not running`.
- A job page never loads for the agent even though Chrome looks open.

**Diagnosis**
The agent drives Chrome only through port 9223. If nothing is answering on that
port, there is no browser to drive. Run the one-stop check:

```
node apply/doctor.mjs
```

Read the line about "job-hunt Chrome." Then work through the causes below.

**Fixes**

- **Port 9223 is not answering (Chrome simply is not up).** Start it:
  ```
  ./apply/launch-chrome.sh
  ```
  The script is safe to run anytime — it first probes
  `http://localhost:9223/json/version` and, if the window is already up, prints
  `✓ The job-hunt Chrome window is already running` and exits `0` without opening
  a second one. After launching, it waits two seconds and re-probes; if Chrome is
  still warming up, it tells you to give it a few seconds and re-check with
  `node apply/doctor.mjs`.

- **A Chrome is already using that profile without the debug port.** Chrome
  reuses one process per profile. If a window for `~/.career-kit-chrome` is
  already open but was started **without** `--remote-debugging-port`, a fresh
  launch attaches to that existing process and the port never opens. Fully quit
  every window belonging to the job-hunt profile, then re-run
  `./apply/launch-chrome.sh`.

- **A stale profile lock from a crash.** If Chrome was force-quit or crashed, a
  leftover lock file in the profile can block a clean relaunch. Quit any job-hunt
  Chrome, remove the stale lock, and relaunch:
  ```
  rm -f ~/.career-kit-chrome/SingletonLock
  ./apply/launch-chrome.sh
  ```
  (This is standard Chrome profile-lock behavior; the launch script does not
  clear the lock for you, so this step is manual.)

- **Chrome is installed somewhere else.** Both `launch-chrome.sh` and
  `doctor.mjs` look for Chrome at
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` by default and
  both honor a `CHROME_PATH` override. If Chrome lives elsewhere, point them at
  it for the session:
  ```
  export CHROME_PATH="/path/to/Google Chrome.app/Contents/MacOS/Google Chrome"
  ./apply/launch-chrome.sh
  node apply/doctor.mjs
  ```
  If Chrome is not installed at all, get it from https://www.google.com/chrome/.

---

## 2. Simplify is not detected or is not autofilling

**Symptoms**
- `node apply/doctor.mjs` prints
  `⚠ Simplify Copilot not detected in the job-hunt profile`.
- The form loads but no Simplify autofill panel or button appears.
- Simplify's panel appears but the fields stay empty.

**Diagnosis**
The doctor scans the dedicated profile's installed-extension manifests for a name
matching "simplify." A warning there means the extension is not installed **in
the job-hunt profile** — installing it in her normal Chrome does not count,
because that is a separate profile the agent never touches.

**Fixes**

- **Install (or reinstall) Simplify in the right window.** Open the job-hunt
  Chrome — `./apply/launch-chrome.sh` — and, in **that** window, install the
  extension and sign in there:
  https://simplify.jobs/copilot
  Re-run `node apply/doctor.mjs` to confirm the `✓ Simplify Copilot is installed`
  line.

- **The button never appears, or the site is unsupported.** Simplify occasionally
  ships an extension update that moves the DOM, and some job sites are simply not
  in its supported list. Either way, this is not a dead end: **the flow degrades
  gracefully.** The upstream apply mode plus the answer bank still complete the
  form field by field. Simplify is an accelerator, not a dependency — losing it
  makes an application slower, not impossible. Tell the agent "Simplify isn't
  showing up," and it will fill the form the manual-assisted way.

---

## 3. Unpacked-extension fallback (only if the Web Store is unavailable)

Use this **only** when the Chrome Web Store install in Section 2 is not an option
(for example, the Web Store is blocked). The Web Store path is strongly preferred.

**Steps**
1. Obtain the Simplify extension package (the CRX or zip).
2. In the job-hunt Chrome window, go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unpacked extension folder, making sure
   you are doing this in the dedicated job-hunt profile (not her normal Chrome).

**Trade-off**
A load-unpacked extension does **not** auto-update. She will have to refresh it
by hand when Simplify ships changes, and a stale copy is the most likely cause of
future autofill breakage. Return to the Web Store install (Section 2) as soon as
it is available again.

---

## 4. Fully manual apply path (no automation at all)

If Chrome, CDP, and Simplify are all unavailable, she can still apply and still
stay tracked — she just does the clicking, and the agent is her assistant.

**How it works**
1. She opens the job posting in **any** browser she likes.
2. The agent supplies the path to the tailored resume for that job — the
   `output/cv-*.pdf` for that company — so she can upload it herself.
3. When she hits a question she is unsure about, she asks the agent, which reads
   the saved answer straight from the answer bank:
   ```
   node apply/answers.mjs --lookup "<question>"
   ```
   She copies the answer into the form. If a question has no saved answer yet,
   she answers it once and the agent banks it for every future application:
   ```
   node apply/answers.mjs --add --label "..." --answer "..." [--match "a,b"]
   ```
4. **Tracking still works.** When she has submitted, she tells the agent, and it
   updates the tracker (see Section 7). Nothing about the manual path skips the
   record-keeping.

The only thing she loses on this path is speed. Every safeguard — her reviewing
each field, her being the one to click Submit — is already how the automated flow
works, so the manual path is not less safe, just more hands-on.

---

## 5. What to expect from ATS autofill accuracy

Autofill coverage varies a lot by applicant-tracking system. Rough, honest
expectations:

| ATS | Approximate autofill coverage |
|---|---|
| Greenhouse / Lever | 85–90 % |
| Workday | 70 % |
| iCIMS | 40–50 % |

So on a Greenhouse or Lever posting, most fields land automatically and the agent
mainly verifies. On an iCIMS posting, expect roughly half the fields to need
manual completion — that is normal, not a failure. Reaching an 85–90 % fill on
one site and a 40–50 % fill on another is exactly the spread to plan for.

Multi-step systems (Workday is the classic) walk through several pages before the
review screen. On those, the agent may click only **safe navigation** controls —
`Next`, `Continue`, and `Save and Continue` — to move between steps, and it always
halts at anything that looks like a final submit. More steps mean more places the
agent pauses and hands the page back to her; that is the design, not a stall.

---

## 6. The submit-guard, honestly

`apply/submit-guard.mjs` is a PreToolUse hook wired in `overlay/.claude/settings.json`
for `browser_click`, `browser_type`, `browser_press_key`, `browser_evaluate`, and
`browser_run_code_unsafe`. When it blocks a call, it prints a line beginning
`SUBMIT GUARD: blocked …` and stops the action.

**What it blocks**
- A `browser_click` on any element whose accessible label matches a submit pattern
  (`submit`, `send my/your application`, `finish application`,
  `complete application`, `confirm application`).
- A `browser_type` with `submit: true` — because typing with submit pressed sends
  Enter, which can submit the form.
- A `browser_press_key` press of a submit-capable key: bare `Enter`, `Return`, or
  `NumpadEnter`, or the Ctrl/Cmd/Meta+Enter textarea-submit accelerator.
  Shift+Enter is allowed — it inserts a newline, not a submit.
- A `browser_evaluate` or `browser_run_code_unsafe` script that calls a form
  submit API (`.submit(` or `requestSubmit(`), performs any scripted click or
  double-click, presses a submit-capable key the same way `browser_press_key`
  does, or is sourced from a `filename` instead of inline code — a file the
  guard cannot vet is refused outright.

**What it deliberately allows**
- **"Apply now" buttons.** These open the application form; they do not send it.
  Blocking them would stop the flow before it starts, so they are allowed on
  purpose.

**Documented residual limits (the honest part)**
- **The hook is focus-blind.** It sees only the key pressed or the code being
  run, not which element has focus, so `browser_press_key` blocks Enter
  unconditionally — even when focus is somewhere harmless, like a search box.
  That is a deliberate, conservative choice; the apply skill guides the agent
  to CLICK a highlighted combobox/`<select>` option to confirm it rather than
  press Enter.
- **No static text filter is perfect.** The guard matches on labels and code
  text; an oddly named submit button could slip a match, or a harmless button
  could trip one.

Because of those limits, the real safeguard is **layered**, not a single regex:
the hook, plus the agent's instructions to never submit, plus — the load-bearing
layer — **her reviewing every page before she clicks Submit herself.** No
application is ever sent without her looking at it and clicking the button.

**When you see `SUBMIT GUARD: blocked …`, that is the system working — not an
error.** It means the agent reached for something submit-like and the guard
stopped it. The right response is to let the agent hand the page back to her for
review.

---

## 7. When the tracker and reality disagree

**Symptoms**
- She submitted an application but the tracker still shows it as unsent.
- The tracker shows an application as submitted that she never actually sent.

**Diagnosis**
By design, a status only changes on **her word.** The agent does not mark
anything "applied" from watching the browser — DOM detection is assistive only —
so the tracker and reality drift apart whenever a submission (or a skip) happens
without her telling the agent. This is intentional: it keeps the record honest to
what she actually did.

**Fix**
Tell the agent the true state ("I submitted the Acme application," or "I didn't
end up sending that one"), and it updates the row. Status writes go through the
upstream `set-status.mjs` script — the verified syntax is:

```
node set-status.mjs <report#|company> <state> [--note "..."] [--role "..."] [--dry-run] [--json]
```

The tracker itself lives in `data/applications.md` as a plain Markdown table, so
a single stray row can also be corrected by hand if needed. Either way, the
tracker follows her — she is the source of truth for what was submitted.

---

## Cannot-verify flags (facts not confirmable from the source files)

These statements come from the plan, upstream conventions, or standard tooling
behavior rather than from a file inspected for this document. They are called out
so nobody treats them as verified from the repo:

- **The ATS accuracy percentages** (85–90 % / 70 % / 40–50 %) come from the
  project plan's research notes, not from a live measurement in this repo.
- **The stale-lock remedy** (`rm -f ~/.career-kit-chrome/SingletonLock`) and the
  "Chrome already holding the profile without the debug port" behavior are
  standard Chrome profile-lock facts; the launch script does not encode or
  automate them.
- **The unpacked-extension source (CRX/zip location)** for Simplify is not
  specified in any provided file; obtain it from Simplify directly, and prefer the
  Web Store install whenever possible.
