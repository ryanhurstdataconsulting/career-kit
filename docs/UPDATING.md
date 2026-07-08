# Updating career-kit

This is a maintainer runbook (Ryan-facing), not the gift recipient's documentation. It explains
what each update path in `setup.sh` actually touches, based on the script's own logic — not on
what it's supposed to do.

## The three kinds of "update"

There are three distinct things "update" can mean here. Each has one command.

| What you're refreshing | Command |
|---|---|
| Upstream career-ops (the near-daily-release engine) | `./setup.sh --update` |
| The kit itself (this repo's own files) | `git pull`, then `./setup.sh --update` |
| A repair or reinstall of the current state | `./setup.sh` (no flag) |

The third row is easy to mistake for a no-op — it isn't quite the same as `--update`. Plain
`./setup.sh` re-scaffolds and re-syncs the whole upstream tree (`modes/`, the scripts, the
templates, everything career-ops ships), just as a first install would. What it never touches is
the same in both modes: the by-name user-layer files listed below **and** the four user-data
trees (`data/`, `output/`, `reports/`, `interview-prep/`) are excluded from the main sync
unconditionally. The one behavioral difference between the modes is a seeding pass that only
plain mode runs: after the main sync, plain mode copies whatever upstream ships inside those four
trees with `rsync -a --ignore-existing` — missing files are created, existing files are never
overwritten — so a fresh install still materializes the directory skeleton upstream ships
(today's scaffold ships nothing but empty subdirectories there). `--update` skips even that
pass: once she's using the kit, those trees are hers, and an update does not write into them
at all.

## What's always protected

`setup.sh`'s `EXCLUDES` list (step 3) is the ground truth. Three things live in it:

**Repo control files and metadata** — excluded so the upstream sync never clobbers the kit's own
identity:
- `.git`, `.gitignore`
- `README.md`, `CLAUDE.md`

**User-layer files, excluded by exact name** — these never ship in upstream's scaffold, so the
excludes are a no-op on first install and a safety net on every later run:
- `cv.md`
- `portals.yml`
- `article-digest.md`
- `config/profile.yml`
- `config/portals.yml`
- `modes/_profile.md`
- `modes/_custom.md`

**The four user-data trees, excluded as whole directories:**
- `data/`
- `output/`
- `reports/`
- `interview-prep/`

Every one of these excludes applies in **both** plain and `--update` mode — the `EXCLUDES` list
in the script has no mode conditional at all. The only mode-dependent step is the install-only
seeding pass described above, and that pass is `--ignore-existing`, so it can create files inside
the four trees but can never overwrite one.

Separately, everything under `seed/` is applied with `rsync -a --ignore-existing`. That means each
seed file is written exactly once, the first time it's missing at the destination; from then on,
`setup.sh` never overwrites it, even in plain mode, even if upstream also ships a file at that
path. Once she's edited a seeded file, it's hers — `setup.sh` won't touch it again.

(One more layer of protection worth knowing about, though it's not in `setup.sh`: `.gitignore`
tracks only kit-authored files, whitelist-style. Personal data — `cv.md`, `config/profile.yml`,
everything under `data/`, `output/`, `reports/` — is never tracked by this repo's git history in
the first place, independent of anything the installer does.)

## What `--update` refreshes

`--update` runs the very same sync as plain mode — the exclude list is identical in both modes —
and differs only in skipping the install-only seeding pass, so it writes nothing at all inside
`data/`, `output/`, `reports/`, or `interview-prep/`. What the sync refreshes:

- Upstream code paths: `modes/`, the deterministic scripts (`scan.mjs`, `generate-pdf.mjs`,
  `set-status.mjs`, `stats.mjs`, `doctor.mjs`, and the rest), the CV template, and
  `.claude/skills/career-ops/`.
- `README.upstream.md` and `CLAUDE.upstream.md` — fresh copies of upstream's own README and
  CLAUDE.md, taken right after the sync so the kit's own `README.md`/`CLAUDE.md` (which are
  excluded, per above) can bridge to whatever upstream currently says.
- Node dependencies: `npm install` at the kit root, plus the headless-Chromium browser via
  `npx playwright install chromium` (upstream's PDF renderer needs it).
- The `.career-ops-version` pin — overwritten with whatever version `npx @santifer/career-ops
  init` just scaffolded.
- Both health checks run at the end of every invocation, update or not, and both need to come
  back green: the upstream doctor (`node doctor.mjs`, informational — the script runs it with
  `|| true` and won't fail the install over it) and the kit's own setup doctor
  (`node apply/doctor.mjs --setup`, which **can** fail the run, since nothing shields it).

## Policy — the overlay only adds

The overlay never patches an upstream file in place. It only adds files at new paths, and it's
guaranteed to win any path collision: `setup.sh` syncs upstream into the repo root first (step 3),
then syncs `overlay/` on top of that (step 4). If a kit-owned path and an upstream path ever
collide, whatever the overlay wrote in step 4 is what's on disk when the script exits — the
upstream copy from step 3 is already overwritten by the time the run finishes.

That ordering is also why upstream's near-daily release cadence can't break the kit: because the
kit never edits an upstream file, there's no patch to go stale and no diff to reconcile when
upstream ships something new. The only way this policy could fail is if upstream ever publishes a
file at the *same relative path* as a kit overlay file — in which case, per the ordering above,
the overlay still wins, but it's worth catching such a collision in review before it ships, since
it would mean upstream and the kit now disagree about what belongs at that path. That's exactly
what testing an update before shipping it is for.

## Test before you tell her to update

Before telling her to run an update, run it yourself first, on a scratch copy, and check both
doctors. In practice: `./setup.sh --update` in a disposable clone (never her live install), then
confirm both the upstream doctor and `apply/doctor.mjs --setup` finish with no errors. The full
step-by-step recipe for this — how to set up the scratch copy, what "green" looks like for each
doctor, and what to check by hand beyond the doctors' own output — is `docs/TEST-CHECKLIST.md`,
stage 1. Run it before every `--update` you're about to hand her, not just the first one.

## Evidence — 2026-07-07 idempotency test

On 2026-07-07, an idempotency test planted 8 user-layer files — `cv.md`, `config/profile.yml`,
`modes/_profile.md`, `portals.yml`, user-edited seed files, `data/answers.yml`, and
`data/applications.md` — then ran plain `./setup.sh` followed by `./setup.sh --update` against
that same install. All 8 files' checksums came back unchanged across both runs, the
`.career-ops-version` pin held at 1.18.0, and both doctors reported green after each run.

## Rollback — there is no version selector

There's no version-selector flag and no rollback command. `setup.sh` always fetches whatever
`npx -y @santifer/career-ops init` currently resolves to — the latest published release — in
both plain and `--update` mode. `.career-ops-version` records which release is currently
installed; `setup.sh` never reads that file back, so it can't be edited to request an older
release either. If a fresh upstream release breaks something, the fix is to wait for upstream to
publish a corrected release or report the issue on the career-ops repo — there's no supported way
to pin backward from here. Either way, her personal data is unaffected: nothing in the excludes
or the overlay-wins ordering above depends on which upstream version is installed.
