#!/usr/bin/env node
// career-kit doctor — health checks for the apply layer (the kit's additions;
// upstream doctor.mjs covers the career-ops core).
//
//   node apply/doctor.mjs           everyday check (includes the live-Chrome probe)
//   node apply/doctor.mjs --setup   install-time check (skips the live-Chrome probe)
//
// Exits 1 only on hard failures; warnings (⚠) explain how to fix themselves.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SETUP_MODE = process.argv.includes('--setup');
const PORT = 9223;
const PROFILE = join(homedir(), '.career-kit-chrome');
const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

let hardFail = false;
const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m) => console.log(`  ⚠ ${m}`);
const bad = (m) => {
  console.log(`  ✗ ${m}`);
  hardFail = true;
};

console.log('career-kit apply doctor');

// 1. Dependencies installed?
if (existsSync(join(ROOT, 'node_modules', 'js-yaml'))) {
  ok('npm dependencies are installed');
} else {
  bad('node_modules/ is missing js-yaml — run ./setup.sh');
}

// 2. Chrome binary
if (existsSync(CHROME)) {
  ok('Google Chrome is installed');
} else {
  warn(`Google Chrome not found at "${CHROME}" — install it from https://www.google.com/chrome/ (or set CHROME_PATH)`);
}

// 3. Dedicated profile + Simplify extension
if (!existsSync(PROFILE)) {
  warn('job-hunt Chrome profile not created yet — run ./apply/launch-chrome.sh once');
} else {
  ok('job-hunt Chrome profile exists (~/.career-kit-chrome)');
  let simplify = false;
  try {
    // Scan installed extensions' manifests for Simplify by name.
    const extRoot = join(PROFILE, 'Default', 'Extensions');
    if (existsSync(extRoot)) {
      outer: for (const extId of readdirSync(extRoot)) {
        const extDir = join(extRoot, extId);
        for (const ver of readdirSync(extDir)) {
          const manifestPath = join(extDir, ver, 'manifest.json');
          if (!existsSync(manifestPath)) continue;
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
          let name = String(manifest.name ?? '');
          if (name.startsWith('__MSG_')) {
            // Localized name — check the default locale's messages file.
            const key = name.slice(6, -2);
            const locale = manifest.default_locale ?? 'en';
            const msgPath = join(extDir, ver, '_locales', locale, 'messages.json');
            if (existsSync(msgPath)) {
              const msgs = JSON.parse(readFileSync(msgPath, 'utf8'));
              name = String(msgs[key]?.message ?? '');
            }
          }
          if (/simplify/i.test(name)) {
            simplify = true;
            break outer;
          }
        }
      }
    }
  } catch {
    // Unreadable profile internals — fall through to the warning.
  }
  if (simplify) {
    ok('Simplify Copilot is installed in the job-hunt profile');
  } else {
    warn('Simplify Copilot not detected in the job-hunt profile — open ./apply/launch-chrome.sh and install it there from https://simplify.jobs/copilot');
  }
}

// 4. Live CDP probe (skipped at install time — Chrome isn't expected to be up yet)
if (!SETUP_MODE) {
  try {
    const res = await fetch(`http://localhost:${PORT}/json/version`, {
      signal: AbortSignal.timeout(1500),
    });
    const info = await res.json();
    ok(`job-hunt Chrome is running (${info.Browser ?? 'CDP'} on port ${PORT})`);
  } catch {
    warn(`job-hunt Chrome is not running — start it with ./apply/launch-chrome.sh`);
  }
}

// 5. Answer bank parses
const answersPath = join(ROOT, 'data', 'answers.yml');
if (!existsSync(answersPath)) {
  ok('answer bank not created yet (it appears after the first saved answer)');
} else {
  try {
    const { default: yaml } = await import('js-yaml');
    const doc = yaml.load(readFileSync(answersPath, 'utf8'));
    if (doc && Array.isArray(doc.answers)) {
      ok(`answer bank parses (${doc.answers.length} saved answer${doc.answers.length === 1 ? '' : 's'})`);
    } else {
      bad('data/answers.yml exists but has no "answers:" list — fix or remove it');
    }
  } catch (err) {
    bad(`data/answers.yml is not valid YAML (${err.message})`);
  }
}

// 6. Playwright browser cache (upstream pdf mode needs it)
const pwCache = join(homedir(), 'Library', 'Caches', 'ms-playwright');
if (
  existsSync(pwCache) &&
  readdirSync(pwCache).some((d) => d.startsWith('chromium'))
) {
  ok('PDF renderer (Playwright Chromium) is installed');
} else {
  warn('PDF renderer not found — run: npx playwright install chromium');
}

console.log(hardFail ? '\nDoctor found problems — see ✗ above.' : '\nAll good.');
process.exit(hardFail ? 1 : 0);
