#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
const assert = require('assert/strict');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { getMobileLockdownE2ERunId } = require('../plugins/mobileLockdown');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const INPUTS = [
  'ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_ARTIFACT',
  'ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_MANIFEST',
  'ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_MANIFEST_SHA256',
];
const DESTINATIONS = [
  'apps/web-embed/web-build',
  'apps/mobile/android/app/src/main/assets/web-embed',
  'apps/mobile/ios/OneKeyWallet/web-embed',
];
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

function assertPlainPath(filename) {
  assert.equal(
    fs.realpathSync(filename),
    path.resolve(filename),
    'Candidate paths must not traverse symbolic links',
  );
  assert.ok(
    !fs.lstatSync(filename).isSymbolicLink(),
    'Candidate paths must not be symbolic links',
  );
}

function readManifest(filename, expectedDigest) {
  assertPlainPath(filename);
  assert.ok(
    fs.lstatSync(filename).isFile(),
    'Expected a regular manifest file',
  );
  const data = fs.readFileSync(filename);
  assert.match(expectedDigest, /^[a-f0-9]{64}$/);
  assert.equal(
    sha256(data),
    expectedDigest,
    'Candidate manifest digest changed',
  );
  const manifest = JSON.parse(data);
  assert.ok(
    manifest && typeof manifest === 'object' && !Array.isArray(manifest),
  );
  assert.ok(
    Object.hasOwn(manifest, 'index.html'),
    'Candidate manifest must include index.html',
  );
  for (const [filenameInManifest, hash] of Object.entries(manifest)) {
    assert.match(filenameInManifest, /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/);
    assert.ok(
      filenameInManifest
        .split('/')
        .every((part) => part !== '.' && part !== '..'),
      'Candidate manifest path escapes its directory',
    );
    assert.ok(
      !filenameInManifest.endsWith('.map') &&
        !filenameInManifest.endsWith('.LICENSE.txt'),
      'Candidate must already be finalized for native assets',
    );
    assert.match(hash, /^[a-f0-9]{64}$/);
  }
  return manifest;
}

function readVerifiedFiles(directory, manifest) {
  assertPlainPath(directory);
  assert.ok(fs.lstatSync(directory).isDirectory());
  const files = new Map();
  const expectedFiles = Object.keys(manifest).toSorted();
  function visit(current, relative = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      assert.ok(
        !entry.isSymbolicLink(),
        'Candidate files must not contain symbolic links',
      );
      const file = relative ? `${relative}/${entry.name}` : entry.name;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        assert.ok(
          expectedFiles.some((name) => name.startsWith(`${file}/`)),
          'Candidate contains an extra directory',
        );
        visit(absolute, file);
      } else {
        assert.ok(entry.isFile(), 'Candidate contains a non-regular file');
        assert.ok(
          Object.hasOwn(manifest, file),
          'Candidate contains an extra file',
        );
        assertPlainPath(absolute);
        const data = fs.readFileSync(absolute);
        assert.equal(
          sha256(data),
          manifest[file],
          `Candidate file digest changed: ${file}`,
        );
        files.set(file, data);
      }
    }
  }
  visit(directory);
  assert.deepEqual(
    [...files.keys()].toSorted(),
    expectedFiles,
    'Candidate files are missing',
  );
  return files;
}

function copyVerifiedFiles({ directory, manifest, files }) {
  let parent = path.dirname(directory);
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  assertPlainPath(parent);
  if (fs.existsSync(directory)) {
    assertPlainPath(directory);
    assert.ok(fs.lstatSync(directory).isDirectory());
  }
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  const staging = fs.mkdtempSync(
    path.join(path.dirname(directory), '.lockdown-web-embed-'),
  );
  try {
    for (const [file, data] of files) {
      const destination = path.join(staging, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, data, { flag: 'wx' });
    }
    readVerifiedFiles(staging, manifest);
    fs.rmSync(directory, { force: true, recursive: true });
    fs.renameSync(staging, directory);
    readVerifiedFiles(directory, manifest);
  } finally {
    fs.rmSync(staging, { force: true, recursive: true });
  }
}

function prepareCandidateWebEmbed({
  env = process.env,
  repoRoot = REPO_ROOT,
} = {}) {
  if (INPUTS.every((key) => env[key] === undefined)) return undefined;
  const runId = getMobileLockdownE2ERunId(env);
  assert.ok(
    runId && env.NODE_ENV === 'production',
    'Candidate assets require an explicit protected Release E2E build',
  );
  assert.ok(
    INPUTS.every((key) => typeof env[key] === 'string' && env[key]),
    'Every candidate artifact/manifest/digest input is required',
  );
  const [artifactInput, manifestInput, manifestDigest] = INPUTS.map(
    (key) => env[key],
  );
  const artifact = path.resolve(artifactInput);
  const destinations = DESTINATIONS.map((relative) =>
    path.join(repoRoot, relative),
  );
  for (const destination of destinations) {
    assert.ok(
      artifact !== destination &&
        !artifact.startsWith(`${destination}${path.sep}`) &&
        !destination.startsWith(`${artifact}${path.sep}`),
      'Candidate source must be independent of generated destinations',
    );
  }
  const manifest = readManifest(path.resolve(manifestInput), manifestDigest);
  const files = readVerifiedFiles(artifact, manifest);
  const {
    validateArtifact,
  } = require('../../../development/lavamoat/smoke-web-embed.cjs');
  const protectedArtifact = validateArtifact(artifact);
  for (const directory of destinations)
    copyVerifiedFiles({ directory, manifest, files });
  assert.deepEqual(
    validateArtifact(destinations[0]),
    protectedArtifact,
    'Protected candidate changed during copying',
  );
  const baseline = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, 'apps/web-embed/scripts/check-browser-compat.js'),
      '--lavamoat',
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  assert.ok(
    !baseline.error && [0, 1].includes(baseline.status),
    'The existing browser baseline checker did not execute',
  );
  const baselineOutput = `${baseline.stdout}${baseline.stderr}`;
  assert.match(
    baselineOutput,
    baseline.status === 0
      ? /Verified .*Chromium 67 syntax compatibility/u
      : /uses unsupported Chromium 67 syntax/u,
    'The existing browser baseline checker failed unexpectedly',
  );
  const report = {
    kind: 'modern-engine-e2e-candidate',
    runId,
    manifestSha256: manifestDigest,
    files: manifest,
    protectedArtifact,
    existingChromium67Baseline: {
      status: baseline.status === 0 ? 'passed' : 'failed',
      output: baselineOutput,
    },
    releaseEligible: false,
  };
  const receipt = path.join(
    repoRoot,
    `apps/mobile/out-dir-bundle/lockdown-web-embed-candidate-${runId}.json`,
  );
  fs.mkdirSync(path.dirname(receipt), { recursive: true });
  assertPlainPath(path.dirname(receipt));
  if (fs.existsSync(receipt)) assertPlainPath(receipt);
  fs.writeFileSync(receipt, `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log(
    `[mobile-lockdown] Modern-engine E2E candidate only; Chromium 67 baseline ${report.existingChromium67Baseline.status}; not release eligible. Receipt: ${receipt}`,
  );
  return report;
}

if (require.main === module) {
  try {
    assert.ok(
      prepareCandidateWebEmbed(),
      'Explicit candidate artifact inputs are required',
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
module.exports = {
  copyVerifiedFiles,
  prepareCandidateWebEmbed,
  readManifest,
  readVerifiedFiles,
};
