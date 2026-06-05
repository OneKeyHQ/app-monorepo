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
const VERSION = '0.1.14-test.1';
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
// Prefer the dedicated NPM_GITHUB_READ_TOKEN; NODE_AUTH_TOKEN is only a tolerated
// fallback for local devs who already export it (we never *set* NODE_AUTH_TOKEN
// ourselves, to avoid colliding with npm/yarn's registry-auth use of that name).
const token = process.env.NPM_GITHUB_READ_TOKEN || process.env.NODE_AUTH_TOKEN;
if (!token) {
  const msg =
    `[tradingview-assets] NPM_GITHUB_READ_TOKEN not set — cannot fetch the offline chart bundle. ` +
    `Set a read:packages token to bundle ${PKG}@${VERSION}.`;
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
  fail(
    `metadata request failed: ${metaRes.status} ${metaRes.statusText}. ` +
      `Check the token has read:packages and the package grants this repo access.`,
  );
}
const meta = await metaRes.json();
const tarballUrl = meta?.versions?.[VERSION]?.dist?.tarball;
if (!tarballUrl)
  fail(`version ${VERSION} not found in registry metadata for ${PKG}`);

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
