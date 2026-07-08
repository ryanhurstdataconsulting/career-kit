---
name: intake
description: Guided get-to-know-you interview that sets up the whole workspace — profile, CV, job boards, archetypes, and answer bank. Use on first run, or to revisit any part of her setup later.
---

# /intake — the get-to-know-you interview

Goal: after this one conversation, the workspace knows her well enough to
find, score, and apply to the right jobs. This wraps upstream onboarding
(`AGENTS.md` → Onboarding) — same output files, same schemas — and adds the
kit extras (archetype emphasis, answer bank) on top.

## Before you start

- Look in `intake/` for a resume or LinkedIn PDF. If one is there, read it
  first and **pre-fill everything you can — confirm, don't re-ask.**
  ("I see you were a marketing coordinator at Acme from 2022 to 2024 — did I
  get that right?") If the folder is empty, mention once that dropping a
  resume in `intake/` saves typing, then carry on without it.
- Tone: relaxed and conversational. One topic at a time, one question at a
  time. It's a chat, not a form. If she's unsure about something, offer a
  sensible default and move on — everything can be revised later.

## The conversation (in this order)

1. **Warm-up** — what kind of work is she looking for, in her own words.
2. **Education** — schools, degrees, dates, anything she's proud of.
3. **Career history** — for each role: company, title, dates, what she
   actually did, and wins with numbers where she has them. This becomes
   `cv.md`, so dig gently for specifics.
4. **What she wants next** — aspirations, target roles and levels. Distill
   these into 2–4 **archetypes** (name, level, fit) for
   `config/profile.yml → target_roles`.
5. **Examples** — ask for 3–5 links to jobs she'd love. Read them; use them
   to sharpen the archetypes and to seed `config/portals.yml` with the
   boards/companies they came from.
6. **Compensation** — target range, hard minimum, currency.
7. **Location and work authorization** — city, timezone, remote/hybrid/onsite
   preference, and authorization/visa status.
8. **Culture and deal-breakers** — what she's avoiding, what she's drawn to
   (→ `culture_screen`).
9. **Practical answers** (seeds the answer bank) — work authorization,
   sponsorship, notice period, willingness to relocate, a default for "How
   did you hear about us?", and the optional EEO questions. For EEO items,
   offer "Prefer not to answer" as the default and never pressure her.

## Write (upstream-exact schemas)

- `config/profile.yml` — follow `config/profile.example.yml` field by field.
- `cv.md` — her canonical CV, from topic 3.
- `config/portals.yml` — seeded from her example links (see upstream scan docs).
- `modes/_profile.md` — archetype narrative mapping, per the upstream template.
- `config/archetype-emphasis.md` — 2–4 emphasis bullets per archetype
  (kit-owned; used by pdf mode).
- Answer bank — one `node apply/answers.mjs --add --label "..." --answer "..."
  [--match "..."]` call per practical answer from topic 9.

## Verify

Run `node cv-sync-check.mjs` and `node doctor.mjs`; fix anything they flag
before declaring intake done.

## Close

Recap what you now know in three or four warm sentences, then offer the next
step: a first scan of her job boards — or, if she already has a job link in
hand, evaluate it right away.
