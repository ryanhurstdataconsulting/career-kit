#!/usr/bin/env bash
# career-kit installer — scaffold the latest career-ops, layer the kit overlay,
# install dependencies, and run health checks. Safe to re-run at any time.
#
#   ./setup.sh            first install (or repair)
#   ./setup.sh --update   refresh career-ops code WITHOUT touching personal data
#
# Design: this repo tracks only kit files (see .gitignore). Upstream career-ops
# is scaffolded fresh into a temp dir on every run and rsynced in — we never
# patch upstream files, so near-daily upstream releases can't break the overlay.
set -euo pipefail

KIT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$KIT_ROOT"

MODE="install"
[ "${1:-}" = "--update" ] && MODE="update"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }

# ---------- 1. Preflight ----------
bold "Checking this Mac…"
if ! command -v node >/dev/null 2>&1; then
  bad "Node.js is not installed."
  echo "    career-kit runs on Node.js (free). Opening the download page —"
  echo "    install the LTS version, then run ./setup.sh again."
  command -v open >/dev/null 2>&1 && open "https://nodejs.org" || true
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  bad "Node.js 20 or newer is required (you have $(node -v))."
  echo "    Install the current LTS from https://nodejs.org and rerun ./setup.sh."
  exit 1
fi
ok "Node $(node -v)"
for tool in git rsync npx curl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    bad "Missing required tool: $tool"
    exit 1
  fi
done
ok "git, rsync, npx, and curl are available"

# ---------- 2. Scaffold the latest career-ops ----------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
bold "Downloading the latest career-ops…"
if ! (cd "$TMP" && npx -y @santifer/career-ops init) >"$TMP/init.log" 2>&1; then
  bad "career-ops init failed — last lines of the log:"
  tail -20 "$TMP/init.log"
  exit 1
fi
UP="$TMP/career-ops"
if [ ! -f "$UP/AGENTS.md" ]; then
  bad "Scaffold looks wrong (no AGENTS.md in $UP)"
  exit 1
fi
UP_VERSION="$(node -p "require('$UP/package.json').version")"
ok "career-ops v$UP_VERSION scaffolded"

# ---------- 3. Sync upstream into this folder ----------
# Always excluded: this repo's own control files, upstream git metadata, every
# user-layer file from upstream's DATA_CONTRACT.md (by NAME), and the four
# user-data trees (as whole directories, in BOTH modes — a repair re-run must
# never overwrite a live tracker, regardless of what upstream's scaffold ships).
# The by-name user files never ship in the scaffold, so those excludes are a
# no-op on first install and a safety net on every later run.
bold "Layering career-ops into this folder…"
EXCLUDES="--exclude=.git --exclude=.gitignore --exclude=LICENSE --exclude=README.md --exclude=CLAUDE.md \
 --exclude=cv.md --exclude=portals.yml --exclude=article-digest.md \
 --exclude=config/profile.yml --exclude=config/portals.yml \
 --exclude=modes/_profile.md --exclude=modes/_custom.md \
 --exclude=data/ --exclude=output/ --exclude=reports/ --exclude=interview-prep/"
# shellcheck disable=SC2086
rsync -a $EXCLUDES "$UP/" "$KIT_ROOT/"
if [ "$MODE" = "install" ]; then
  # First install (or repair): materialize whatever upstream ships inside the
  # user-data trees, but never overwrite a file that already exists there.
  # --update skips this entirely — those trees are hers once she's using the kit.
  for tree in data output reports interview-prep; do
    if [ -d "$UP/$tree" ]; then
      rsync -a --ignore-existing "$UP/$tree/" "$KIT_ROOT/$tree/"
    fi
  done
fi
# Upstream's README, CLAUDE.md, and LICENSE stay available under *.upstream
# names; the kit's own CLAUDE.md (from overlay/) bridges to them.
cp "$UP/README.md" "$KIT_ROOT/README.upstream.md"
cp "$UP/CLAUDE.md" "$KIT_ROOT/CLAUDE.upstream.md"
if [ -f "$UP/LICENSE" ]; then
  cp "$UP/LICENSE" "$KIT_ROOT/LICENSE.upstream"
fi
ok "Upstream synced (its README/CLAUDE.md/LICENSE kept under *.upstream names)"

# ---------- 4. Kit overlay ----------
bold "Applying the career-kit overlay…"
rsync -a "$KIT_ROOT/overlay/" "$KIT_ROOT/"
# Seeds are user-layer starters: copied once, never overwritten afterwards.
rsync -a --ignore-existing "$KIT_ROOT/seed/" "$KIT_ROOT/"
chmod +x "$KIT_ROOT/apply/launch-chrome.sh"
ok "Overlay and seeds in place"

# ---------- 5. Dependencies ----------
bold "Installing dependencies (the first run can take a few minutes)…"
if ! npm install --no-fund --no-audit >"$TMP/npm.log" 2>&1; then
  bad "npm install failed — last lines of the log:"
  tail -20 "$TMP/npm.log"
  exit 1
fi
ok "npm packages installed"
if ! npx playwright install chromium >"$TMP/playwright.log" 2>&1; then
  bad "PDF renderer install failed — last lines of the log:"
  tail -20 "$TMP/playwright.log"
  exit 1
fi
ok "PDF renderer (headless Chromium) installed"

printf '%s\n' "$UP_VERSION" > "$KIT_ROOT/.career-ops-version"

# ---------- 6. Health checks ----------
bold "Running health checks…"
node doctor.mjs || true   # upstream doctor is informative pre-onboarding
node apply/doctor.mjs --setup

bold "You're all set."
echo "  Open this folder in the Claude app's Code tab, and Claude will take it from there."
if [ "$MODE" = "update" ]; then
  echo "  (Updated to career-ops v$UP_VERSION — your profile and data were not touched.)"
fi
