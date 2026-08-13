import { execFileSync } from 'node:child_process';
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
  const serviceWorker = 'const ready = true;';

  if (includeManifest) {
    const manifestFileName = 'tradingview-embed-manifest.test-v1.json';
    const manifestBytes = Buffer.from('{"version":"test-v1"}\n');
    fs.writeFileSync(
      path.join(buildDirectory, manifestFileName),
      manifestBytes,
    );
  }

  fs.writeFileSync(
    path.join(buildDirectory, 'service-worker.js'),
    serviceWorker,
  );
  return buildDirectory;
}

function validateBuild(buildDirectory) {
  return execFileSync(process.execPath, [validatorPath, buildDirectory], {
    encoding: 'utf8',
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

  test('accepts a build without a pinned manifest', () => {
    const buildDirectory = createBuildDirectory();
    buildDirectories.push(buildDirectory);

    expect(validateBuild(buildDirectory)).toContain(
      'TradingView manifest will be resolved from the runtime URL',
    );
  });

  test('rejects a build containing a pinned manifest', () => {
    const buildDirectory = createBuildDirectory({ includeManifest: true });
    buildDirectories.push(buildDirectory);

    expect(() => validateBuild(buildDirectory)).toThrow(
      'Web build must not contain a pinned TradingView embed manifest',
    );
  });
});
