#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = '@onekeyhq/tradingview-charting-library';
const PACKAGE_VERSION = '0.1.21';
const REGISTRY = 'https://npm.pkg.github.com';
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(webRoot, '.generated', 'tradingview-embed');
const required = process.env.TRADINGVIEW_EMBED_REQUIRED === '1';

function fail(message) {
  console.error(`[tradingview-embed] ${message}`);
  process.exit(1);
}

function validateDist(directory) {
  const manifestPath = join(directory, 'embed-manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    fail('embed-manifest.json is missing or invalid');
  }
  if (
    manifest?.schema !== 1 ||
    manifest?.version !== PACKAGE_VERSION ||
    typeof manifest?.entry !== 'string' ||
    !Array.isArray(manifest?.assets)
  ) {
    fail(`invalid embed manifest for ${PACKAGE_NAME}@${PACKAGE_VERSION}`);
  }
}

function stage(directory) {
  validateDist(directory);
  rmSync(destination, { force: true, recursive: true });
  mkdirSync(destination, { recursive: true });
  cpSync(directory, destination, { recursive: true });
  console.log(`[tradingview-embed] staged ${directory} -> ${destination}`);
}

const localDirectory = process.env.TRADINGVIEW_EMBED_LOCAL_DIR;
if (localDirectory) {
  stage(resolve(localDirectory));
  process.exit(0);
}

function getGitHubToken() {
  if (process.env.NPM_GITHUB_READ_TOKEN || process.env.NODE_AUTH_TOKEN) {
    return process.env.NPM_GITHUB_READ_TOKEN || process.env.NODE_AUTH_TOKEN;
  }
  try {
    return execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

const token = getGitHubToken();
if (!token) {
  const message = `no read:packages token for ${PACKAGE_NAME}@${PACKAGE_VERSION}`;
  if (required) {
    fail(message);
  }
  console.warn(
    `[tradingview-embed] ${message}; Web will use the hosted iframe fallback.`,
  );
  process.exit(0);
}

const headers = { Authorization: `Bearer ${token}` };
const metadataResponse = await fetch(`${REGISTRY}/${PACKAGE_NAME}`, {
  headers,
});
if (!metadataResponse.ok) {
  fail(`metadata request failed: ${metadataResponse.status}`);
}
const metadata = await metadataResponse.json();
const tarballUrl = metadata?.versions?.[PACKAGE_VERSION]?.dist?.tarball;
if (!tarballUrl) {
  fail(`package version ${PACKAGE_VERSION} was not found`);
}
if (new URL(tarballUrl).origin !== new URL(REGISTRY).origin) {
  fail('tarball URL origin mismatch');
}

const tarballResponse = await fetch(tarballUrl, { headers });
if (!tarballResponse.ok) {
  fail(`tarball request failed: ${tarballResponse.status}`);
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'onekey-tv-embed-'));
const tarballPath = join(temporaryDirectory, 'package.tgz');
writeFileSync(tarballPath, Buffer.from(await tarballResponse.arrayBuffer()));
try {
  execFileSync(
    'tar',
    ['-xzf', tarballPath, '-C', temporaryDirectory, 'package/dist-embed'],
    { stdio: 'inherit' },
  );
  stage(join(temporaryDirectory, 'package', 'dist-embed'));
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}
