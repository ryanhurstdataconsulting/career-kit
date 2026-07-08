#!/usr/bin/env bash
# Open the dedicated job-application Chrome window (the one with Simplify).
# Claude connects to this window over CDP; the human watches everything it does.
# The profile lives in ~/.career-kit-chrome — completely separate from normal
# Chrome, so Simplify and job-site logins stay contained.
set -u

PORT=9223
PROFILE="$HOME/.career-kit-chrome"
CHROME="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

if curl -sf --max-time 2 "http://localhost:$PORT/json/version" >/dev/null 2>&1; then
  echo "✓ The job-hunt Chrome window is already running (port $PORT)."
  exit 0
fi

if [ ! -x "$CHROME" ]; then
  echo "✗ Google Chrome was not found at: $CHROME"
  echo "  Install Chrome from https://www.google.com/chrome/ (or set CHROME_PATH)."
  exit 1
fi

mkdir -p "$PROFILE"
nohup "$CHROME" \
  --user-data-dir="$PROFILE" \
  --remote-debugging-port="$PORT" \
  --no-first-run \
  --no-default-browser-check \
  >/dev/null 2>&1 &

sleep 2
if curl -sf --max-time 2 "http://localhost:$PORT/json/version" >/dev/null 2>&1; then
  echo "✓ Job-hunt Chrome is up (port $PORT). It is separate from your normal Chrome."
else
  echo "… Chrome is still starting — give it a few seconds, then check again with:"
  echo "  node apply/doctor.mjs"
fi

echo
echo "First time in this window? Install the Simplify Copilot extension HERE"
echo "(not in your normal Chrome) and sign in: https://simplify.jobs/copilot"
