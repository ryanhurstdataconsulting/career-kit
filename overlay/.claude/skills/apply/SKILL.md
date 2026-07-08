---
name: apply
description: Fill a job application in her Chrome using Simplify and the tailored resume, then hand it to her for review — never submits. Use when she wants to apply to a job.
---

# /apply — fill an application for her review

Follow upstream `modes/apply.md` (the form engine) with the kit deltas below.
The final click is always hers.

## 0. Health check

Run `node apply/doctor.mjs`. If Chrome or the CDP port is down, offer to start
`./apply/launch-chrome.sh` for her (run it on her go-ahead; it opens her
separate job-hunt Chrome window).

## 1. Pick the job

If she named one, use it. Otherwise run `node apply/queue.mjs --next` and
confirm the pick: "Next up is <Role> at <Company> — it scored <N>. Want to
apply to this one?" If the JSON says `belowThreshold: true`, mention the score
is under 4.0 and let her decide.

## 2. Tailored resume

Find this job's `output/cv-*.pdf`. If it doesn't exist, run pdf mode first
(consulting `config/archetype-emphasis.md`). Never proceed with a generic or
default resume.

## 3. Preflight and fill

Run upstream `modes/apply.md` in full: the liveness/duplicate preflight, the
knock-out pre-scan, and the per-ATS quirks in `docs/APPLY_AUTOFILL.md`. On top
of that:

- **Simplify.** Once the form has loaded, look for the Simplify Copilot
  panel/button in the snapshot. If present, click its autofill, wait for it to
  finish, re-snapshot, then verify and complete every field yourself.
- **Resume.** Upload the tailored PDF with `browser_file_upload` into the
  resume input — even if Simplify already attached one, replace it.
- **Unknown required fields.** For each field you can't answer:
  1. `node apply/answers.mjs --lookup "<field label>"`
  2. On a miss, ask her — conversationally, one question at a time.
  3. If her answer is durable (it would recur on other applications), save it:
     `node apply/answers.mjs --add --label "<label>" --answer "<answer>"
     [--match "<comma-separated rewordings>"]`
  4. Fill the field and continue. Never guess at an answer.
- **Multi-step forms.** Click only Next / Continue / Save and Continue. When a
  submit-like control appears, stop — that page belongs to her. Because the
  guard blocks Enter, select combobox/autocomplete options by clicking them
  (`browser_click`, or `browser_select_option` for a native `<select>`)
  rather than pressing Enter to confirm a highlighted option.

## 4. The review gate (say exactly this)

Before the gate message, name any fields you left blank or were unsure
about, so she can finish them before she reviews and submits.

"The application is filled in and waiting in Chrome. Please look it over
carefully — check every field, especially anything I filled in for you. When
everything looks right, click Submit yourself; I'll never click it for you.
Tell me when you've submitted it, or if you'd rather skip this one."

## 5. After her word — and only her word

- She says she submitted → mark it Applied via `set-status.mjs`, persist the
  application answers, and run the follow-up seeding, all per `modes/apply.md`.
- She says skip → set the status she prefers (SKIP or Discarded) and note why.
- Never infer submission from the page alone; her word is the trigger.

## If the submit guard blocks you

That is the system working. Don't retry and don't look for another path to
the same click — tell her the form is ready and the Submit click is hers.
