#!/usr/bin/env node
/**
 * Fetch the private TradingView chart bundle and stage its dist/ for the
 * desktop app. The staged directory is included in the desktop asar outside the
 * renderer build/, so it ships in installers but never enters JS hot updates.
 *
 * Auth: reads NPM_GITHUB_READ_TOKEN first, then NODE_AUTH_TOKEN, then a local
 * `gh auth token` fallback. No token skips silently unless
 * TRADINGVIEW_ASSETS_REQUIRED=1 is set.
 *
 * Version: set TRADINGVIEW_CHART_PACKAGE_VERSION to pin a specific package
 * version. When omitted, the package's latest dist-tag is used.
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

const PKG = '@onekeyhq/tradingview-charting-library';
const REGISTRY = 'https://npm.pkg.github.com';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEST_DIR = join(
  REPO_ROOT,
  'apps',
  'desktop',
  'app',
  'tradingview-assets',
);

const required = !!process.env.TRADINGVIEW_ASSETS_REQUIRED;

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

const GH_SCOPE_HINT =
  'Your GitHub CLI login is missing the `read:packages` scope. Grant it with:\n' +
  '  gh auth refresh -h github.com -s read:packages';

function ghTokenMissingReadPackages() {
  try {
    const out = execFileSync('gh', ['auth', 'status'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const line = out.split('\n').find((l) => l.includes('Token scopes:'));
    return line ? !line.includes('read:packages') : false;
  } catch {
    return false;
  }
}

const envToken =
  process.env.NPM_GITHUB_READ_TOKEN || process.env.NODE_AUTH_TOKEN;
const token = envToken || ghAuthToken();
const tokenFromGh = !envToken && !!token;

if (tokenFromGh && ghTokenMissingReadPackages()) {
  const msg = `[tradingview-assets] ${GH_SCOPE_HINT}`;
  if (required) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`${msg}\nSkipping; desktop will use the online chart.`);
  process.exit(0);
}

if (!token) {
  const msg = `[tradingview-assets] NPM_GITHUB_READ_TOKEN not set and no gh CLI token; cannot fetch ${PKG}.`;
  if (required) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`${msg} Skipping; desktop will use the online chart.`);
  process.exit(0);
}

function fail(msg) {
  console.error(`[tradingview-assets] ${msg}`);
  process.exit(1);
}

const authHeaders = { Authorization: `Bearer ${token}` };
const metaRes = await fetch(`${REGISTRY}/${PKG}`, { headers: authHeaders });
if (!metaRes.ok) {
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
const version =
  process.env.TRADINGVIEW_CHART_PACKAGE_VERSION || meta?.['dist-tags']?.latest;
if (!version) {
  fail(
    'TRADINGVIEW_CHART_PACKAGE_VERSION is not set and package metadata has no latest dist-tag',
  );
}

const tarballUrl = meta?.versions?.[version]?.dist?.tarball;
if (!tarballUrl) {
  fail(`version ${version} not found in registry metadata for ${PKG}`);
}

const expectedOrigin = new URL(REGISTRY).origin;
const tarballOrigin = new URL(tarballUrl).origin;
if (tarballOrigin !== expectedOrigin) {
  fail(
    `tarball URL origin mismatch: expected ${expectedOrigin}, got ${tarballOrigin}`,
  );
}

const tgzRes = await fetch(tarballUrl, { headers: authHeaders });
if (!tgzRes.ok) {
  fail(`tarball download failed: ${tgzRes.status} ${tgzRes.statusText}`);
}

const tmp = mkdtempSync(join(tmpdir(), 'tv-assets-'));
const tgzPath = join(tmp, 'pkg.tgz');
writeFileSync(tgzPath, Buffer.from(await tgzRes.arrayBuffer()));

try {
  execFileSync('tar', ['-xzf', tgzPath, '-C', tmp, 'package/dist'], {
    stdio: 'inherit',
  });
} catch {
  rmSync(tmp, { recursive: true, force: true });
  fail('failed to extract package/dist from tarball');
}

const distSrc = join(tmp, 'package', 'dist');
let distEntries = [];
try {
  distEntries = readdirSync(distSrc);
} catch {
  // handled by the empty check below
}

if (distEntries.length === 0) {
  rmSync(tmp, { recursive: true, force: true });
  fail(`extracted dist/ is empty for ${PKG}@${version}`);
}

rmSync(DEST_DIR, { recursive: true, force: true });
mkdirSync(DEST_DIR, { recursive: true });
cpSync(distSrc, DEST_DIR, { recursive: true });
console.log(
  `[tradingview-assets] staged ${PKG}@${version} dist -> ${DEST_DIR}`,
);
rmSync(tmp, { recursive: true, force: true });
