import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const validatorPath = path.resolve(
  __dirname,
  'validate-built-service-worker.mjs',
);

function createBuildDirectory({ includeManifest = false } = {}) {
  const buildDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'tradingview-embed-build-'),
  );
  let serviceWorker = 'const ready = true;';

  if (includeManifest) {
    const manifestFileName = 'tradingview-embed-manifest.test-v1.json';
    const manifestBytes = Buffer.from('{"version":"test-v1"}\n');
    const integrity = `sha384-${createHash('sha384')
      .update(manifestBytes)
      .digest('base64')}`;
    fs.writeFileSync(
      path.join(buildDirectory, manifestFileName),
      manifestBytes,
    );
    serviceWorker = `const manifest = '${manifestFileName}'; const integrity = '${integrity}';`;
  }

  fs.writeFileSync(
    path.join(buildDirectory, 'service-worker.js'),
    serviceWorker,
  );
  return buildDirectory;
}

function validateBuild(buildDirectory, required) {
  return execFileSync(process.execPath, [validatorPath, buildDirectory], {
    encoding: 'utf8',
    env: {
      ...process.env,
      TRADINGVIEW_EMBED_REQUIRED: required ? '1' : '0',
    },
    stdio: 'pipe',
  });
}

describe('validate-built-service-worker', () => {
  const buildDirectories = [];

  afterEach(() => {
    for (const buildDirectory of buildDirectories.splice(0)) {
      fs.rmSync(buildDirectory, { force: true, recursive: true });
    }
  });

  test('rejects a required build without a pinned manifest', () => {
    const buildDirectory = createBuildDirectory();
    buildDirectories.push(buildDirectory);

    expect(() => validateBuild(buildDirectory, true)).toThrow(
      'Web build does not contain a pinned TradingView embed manifest',
    );
  });

  test('accepts a required build with a valid pinned manifest', () => {
    const buildDirectory = createBuildDirectory({ includeManifest: true });
    buildDirectories.push(buildDirectory);

    expect(validateBuild(buildDirectory, true)).toContain(
      'verified pinned TradingView manifest',
    );
  });

  test('keeps iframe fallback available for non-release builds', () => {
    const buildDirectory = createBuildDirectory();
    buildDirectories.push(buildDirectory);

    expect(validateBuild(buildDirectory, false)).toContain(
      'iframe fallback remains enabled',
    );
  });
});
