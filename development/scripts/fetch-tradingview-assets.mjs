#!/usr/bin/env node
/**
 * Fetch the private TradingView chart bundle and stage its dist/ for the native
 * apps. The package (@onekeyhq/tradingview-charting-library) is published to
 * GitHub Packages; this script downloads its tarball directly, extracts only
 * dist/, and drops it into a single shared staging dir (apps/mobile/tradingview-assets/).
 *
 * The native builds pick up that staging dir:
 *   - iOS: a Run Script build phase copies it into the app bundle's tradingview-assets/
 *   - Android: the copyChartWebviewAssets Gradle task copies it into
 *     assets/tradingview-assets/  (chart-webview loads assets/<localBundle>/)
 *   - Desktop: staged into apps/desktop/app/tradingview-assets/, which electron-builder
 *     bundles into app.asar (outside build/, so it never enters the hot-update bundle);
 *     the main process serves it under the onekey-chart:// custom scheme.
 *
 * IMPORTANT — this script is intentionally NOT part of `yarn install` /
 * postinstall, and the package is NOT a dependency in any package.json. That
 * keeps open-source contributors (who have no read access to the private
 * package) unblocked: a normal `yarn install` never touches the private
 * registry. Only release builds / internal devs with a token run this.
 *
 * Auth: reads NPM_GITHUB_READ_TOKEN (a GitHub PAT / Actions token with
 * read:packages for the package; NODE_AUTH_TOKEN is accepted as a fallback only).
 * No token -> skip silently (the app falls back to the online chart). Because the
 * package lives in a *different* repo, the default Actions GITHUB_TOKEN cannot
 * read it — CI must pass a PAT with org-level read:packages (the
 * NPM_GITHUB_READ_TOKEN secret).
 *
 * Strict mode: set TRADINGVIEW_ASSETS_REQUIRED=1 to turn the silent "no token ->
 * skip" path into a hard error. Release workflows set this so a missing/invalid
 * token fails the build instead of silently shipping the online-fallback chart.
 * Local dev / open-source `yarn install` leave it unset (skip stays silent).
 *
 * Usage:
 *   NPM_GITHUB_READ_TOKEN=<token> node development/scripts/fetch-tradingview-assets.mjs
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Pinned version (single source of truth) ──────────────────────────────────
const PKG = '@onekeyhq/tradingview-charting-library';
const VERSION = '0.1.17';
const REGISTRY = 'https://npm.pkg.github.com';
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// Staging dirs consumed by the native/desktop builds:
//   - mobile: iOS (Run Script) + Android (Gradle copy)
//   - desktop: electron-builder asar (apps/desktop/app/tradingview-assets/**)
const DEST_DIRS = [
  join(REPO_ROOT, 'apps', 'mobile', 'tradingview-assets'),
  join(REPO_ROOT, 'apps', 'desktop', 'app', 'tradingview-assets'),
];

const required = !!process.env.TRADINGVIEW_ASSETS_REQUIRED;

// Last-resort local fallback: pull a token from the GitHub CLI (`gh auth token`)
// when no env token is set. Lets a locally-authenticated dev just run the script
// (no manual token wiring) as long as their gh login carries read:packages.
// Best-effort only — silently yields '' if gh is missing / not logged in, so CI
// behavior (which sets NPM_GITHUB_READ_TOKEN explicitly) is unaffected.
function ghAuthToken() {
  try {
    return execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

// How to grant read:packages to the gh CLI login. Shown when the gh-derived
// token is missing that scope (the package is private on GitHub Packages).
const GH_SCOPE_HINT =
  'Your GitHub CLI login is missing the `read:packages` scope. Grant it with:\n' +
  '  gh auth refresh -h github.com -s read:packages';

// Inspect the gh login's token scopes via `gh auth status`, which prints a
// "Token scopes: 'a', 'b', ..." line for classic OAuth tokens (gh's own login
// token is one). Returns true only when we can positively read the scope list
// AND it lacks read:packages. Returns false when scopes can't be determined
// (gh missing, fine-grained PAT with no scope line, parse failure) so we never
// block on uncertainty — the actual HTTP request stays the source of truth.
function ghTokenMissingReadPackages() {
  try {
    const out = execFileSync('gh', ['auth', 'status'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const line = out.split('\n').find((l) => l.includes('Token scopes:'));
    if (!line) {
      return false;
    }

    return !line.includes('read:packages');
  } catch {
    return false;
  }
}

// Prefer the dedicated NPM_GITHUB_READ_TOKEN; NODE_AUTH_TOKEN is only a tolerated
// fallback for local devs who already export it (we never *set* NODE_AUTH_TOKEN
// ourselves, to avoid colliding with npm/yarn's registry-auth use of that name).
// Finally fall back to the GitHub CLI token for locally-authenticated devs.
const envToken =
  process.env.NPM_GITHUB_READ_TOKEN || process.env.NODE_AUTH_TOKEN;
const token = envToken || ghAuthToken();
const tokenFromGh = !envToken && !!token;

// If we fell back to the gh CLI but that login lacks read:packages, the request
// below would 403 — surface the actionable fix up front instead.
if (tokenFromGh && ghTokenMissingReadPackages()) {
  const msg = `[tradingview-assets] ${GH_SCOPE_HINT}`;
  if (required) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`${msg}\nSkipping — the app will use the online chart.`);
  process.exit(0);
}

if (!token) {
  const msg =
    `[tradingview-assets] NPM_GITHUB_READ_TOKEN not set (and no gh CLI token) — cannot fetch the offline chart bundle. ` +
    `Set a read:packages token or run \`gh auth login\` to bundle ${PKG}@${VERSION}.`;
  if (required) {
    // Release builds opt into strict mode: a missing token must fail the build,
    // not silently ship the online-fallback chart.
    console.error(msg);
    process.exit(1);
  }
  console.warn(`${msg} Skipping — the app will use the online chart.`);
  process.exit(0);
}

const authHeaders = { Authorization: `Bearer ${token}` };

function fail(msg) {
  console.error(`[tradingview-assets] ${msg}`);
  process.exit(1);
}

// 1. Resolve the tarball URL from package metadata.
const metaRes = await fetch(`${REGISTRY}/${PKG}`, { headers: authHeaders });
if (!metaRes.ok) {
  // 401/403 on a gh-derived token almost always means the gh login is missing
  // read:packages (the upfront scope check can't read scopes for fine-grained
  // tokens, so catch it here too).
  const scopeHint =
    tokenFromGh && (metaRes.status === 401 || metaRes.status === 403)
      ? `\n${GH_SCOPE_HINT}`
      : '';
  fail(
    `metadata request failed: ${metaRes.status} ${metaRes.statusText}. ` +
      `Check the token has read:packages and the package grants this repo access.${scopeHint}`,
  );
}
const meta = await metaRes.json();
const tarballUrl = meta?.versions?.[VERSION]?.dist?.tarball;
if (!tarballUrl)
  fail(`version ${VERSION} not found in registry metadata for ${PKG}`);

// Validate the tarball URL origin matches the expected registry before sending
// the auth header. A poisoned/MITM'd metadata response could otherwise point
// `tarball` at an attacker host, leaking the read:packages PAT in the Bearer
// header of the download request below.
const expectedOrigin = new URL(REGISTRY).origin;
const tarballOrigin = new URL(tarballUrl).origin;
if (tarballOrigin !== expectedOrigin) {
  fail(
    `tarball URL origin mismatch: expected ${expectedOrigin}, got ${tarballOrigin}`,
  );
}

// 2. Download the tarball (.tgz).
const tgzRes = await fetch(tarballUrl, { headers: authHeaders });
if (!tgzRes.ok)
  fail(`tarball download failed: ${tgzRes.status} ${tgzRes.statusText}`);
const tgzBuf = Buffer.from(await tgzRes.arrayBuffer());

const tmp = mkdtempSync(join(tmpdir(), 'tv-assets-'));
const tgzPath = join(tmp, 'pkg.tgz');
writeFileSync(tgzPath, tgzBuf);

// 3. Extract only package/dist from the tarball.
try {
  execFileSync('tar', ['-xzf', tgzPath, '-C', tmp, 'package/dist'], {
    stdio: 'inherit',
  });
} catch {
  rmSync(tmp, { recursive: true, force: true });
  fail('failed to extract package/dist from tarball');
}
const distSrc = join(tmp, 'package', 'dist');

// Guard against a tarball that extracted an empty dist/ — staging nothing would
// silently ship a broken (asset-less) offline chart.
let distEntries = [];
try {
  distEntries = readdirSync(distSrc);
} catch {
  /* distSrc missing -> handled by the empty check below */
}
if (distEntries.length === 0) {
  rmSync(tmp, { recursive: true, force: true });
  fail(
    `extracted dist/ is empty for ${PKG}@${VERSION} — refusing to stage an asset-less chart`,
  );
}

// 4. Replace each staging dir with the fresh dist contents.
//    Use fs.cpSync (not rsync) so this runs on Windows CI runners too — they
//    package the desktop app but have no rsync on PATH.
for (const dest of DEST_DIRS) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(distSrc, dest, { recursive: true });
  console.log(`[tradingview-assets] staged ${PKG}@${VERSION} dist -> ${dest}`);
}
rmSync(tmp, { recursive: true, force: true });
