const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const {
  MIN_BASE_VERSION,
  OCI_ARTIFACT_TYPE,
  OCI_REGISTRY,
  OCI_REPOSITORY,
  checkOrPullBaseManifest,
  getOciReference,
  getOciTag,
  isIncrementalSupported,
  pushBaseManifest,
  runCli,
} = require('../ota-base-bundle-oci');

const SCRIPT_PATH = path.resolve(__dirname, '../ota-base-bundle-oci.js');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-base-oci-test-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('exposes expected OCI constants', () => {
  assert.equal(OCI_REGISTRY, 'ghcr.io');
  assert.equal(OCI_REPOSITORY, 'onekeyhq/ota-base-bundle');
  assert.equal(OCI_ARTIFACT_TYPE, 'application/vnd.onekey.ota-base-bundle.v1');
  assert.equal(MIN_BASE_VERSION, '6.8.0');
});

test('isIncrementalSupported enforces >= 6.8.0 semver check', () => {
  assert.equal(isIncrementalSupported('6.8.0'), true);
  assert.equal(isIncrementalSupported('6.8.1'), true);
  assert.equal(isIncrementalSupported('6.9.0'), true);
  assert.equal(isIncrementalSupported('7.0.0'), true);
  assert.equal(isIncrementalSupported('v6.8.0'), true);

  assert.equal(isIncrementalSupported('6.7.99'), false);
  assert.equal(isIncrementalSupported('6.8.0-beta.1'), false);
  assert.equal(isIncrementalSupported(''), false);
  assert.equal(isIncrementalSupported('invalid'), false);
  assert.equal(isIncrementalSupported(null), false);
  assert.equal(isIncrementalSupported(undefined), false);
});

test('getOciTag and getOciReference format tags and references properly', () => {
  assert.equal(
    getOciTag({ appVersion: '6.8.0', platform: 'desktop' }),
    'v6.8.0-desktop',
  );
  assert.equal(
    getOciTag({ appVersion: 'v6.8.1', platform: 'ios' }),
    'v6.8.1-ios',
  );
  assert.equal(
    getOciTag({ appVersion: '6.9.0', platform: 'android' }),
    'v6.9.0-android',
  );

  assert.equal(
    getOciReference({ appVersion: '6.8.0', platform: 'desktop' }),
    'ghcr.io/onekeyhq/ota-base-bundle:v6.8.0-desktop',
  );
  assert.equal(
    getOciReference({
      appVersion: '6.8.0',
      platform: 'ios',
      registry: 'example.com',
      repository: 'org/repo',
    }),
    'example.com/org/repo:v6.8.0-ios',
  );

  assert.throws(
    () => getOciTag({ appVersion: '6.8.0', platform: 'electron' }),
    /Unsupported platform/,
  );
  assert.throws(
    () => getOciTag({ appVersion: 'bad', platform: 'ios' }),
    /Invalid semver/,
  );
});

test('checkOrPullBaseManifest returns found=true when base-metadata.json is pulled', () =>
  withTempDir((tmpDir) => {
    const outputDir = path.join(tmpDir, 'pull-out');
    const calls = [];
    const execFileSyncImpl = (cmd, args) => {
      calls.push({ cmd, args });
      fs.writeFileSync(
        path.join(outputDir, 'base-metadata.json'),
        JSON.stringify({ 'main.jsbundle.hbc': 'abc' }),
      );
      return '';
    };

    const result = checkOrPullBaseManifest({
      appVersion: '6.8.0',
      platform: 'ios',
      outputDir,
      execFileSyncImpl,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].cmd, 'oras');
    assert.deepEqual(calls[0].args, [
      'pull',
      '--output',
      path.resolve(outputDir),
      'ghcr.io/onekeyhq/ota-base-bundle:v6.8.0-ios',
    ]);
    assert.deepEqual(result, {
      found: true,
      metadataPath: path.join(path.resolve(outputDir), 'base-metadata.json'),
      reference: 'ghcr.io/onekeyhq/ota-base-bundle:v6.8.0-ios',
    });
  }));

test('checkOrPullBaseManifest returns found=false on manifest unknown / not found', () =>
  withTempDir((tmpDir) => {
    for (const errText of [
      'Error: ghcr.io/onekeyhq/ota-base-bundle:v6.8.0-desktop: manifest unknown',
      'Error: reference not found',
      'Error: 404 Not Found',
    ]) {
      const outputDir = path.join(tmpDir, 'missing');
      const result = checkOrPullBaseManifest({
        appVersion: '6.8.0',
        platform: 'desktop',
        outputDir,
        execFileSyncImpl: () => {
          const err = new Error('Command failed: oras pull');
          err.stderr = errText;
          throw err;
        },
      });
      assert.deepEqual(result, {
        found: false,
        reference: 'ghcr.io/onekeyhq/ota-base-bundle:v6.8.0-desktop',
      });
    }
  }));

test('checkOrPullBaseManifest returns found=false when pulled base-metadata.json is empty', () =>
  withTempDir((tmpDir) => {
    const outputDir = path.join(tmpDir, 'empty-out');
    const result = checkOrPullBaseManifest({
      appVersion: '6.8.0',
      platform: 'android',
      outputDir,
      execFileSyncImpl: () => {
        fs.writeFileSync(path.join(outputDir, 'base-metadata.json'), '');
        return '';
      },
    });
    assert.deepEqual(result, {
      found: false,
      reference: 'ghcr.io/onekeyhq/ota-base-bundle:v6.8.0-android',
    });
  }));

test('checkOrPullBaseManifest throws on non-404 errors like authentication failures', () =>
  withTempDir((tmpDir) => {
    const outputDir = path.join(tmpDir, 'auth-err');
    assert.throws(
      () =>
        checkOrPullBaseManifest({
          appVersion: '6.8.0',
          platform: 'ios',
          outputDir,
          execFileSyncImpl: () => {
            const err = new Error('Command failed');
            err.stderr = '401 Unauthorized: invalid token';
            throw err;
          },
        }),
      /Failed to pull OTA base manifest/,
    );
  }));

test('pushBaseManifest stages base-metadata.json and base-release.json, invokes oras push, and cleans up temp dir', () =>
  withTempDir((tmpDir) => {
    const metadataPath = path.join(tmpDir, 'metadata.json');
    const metadataBytes = Buffer.from(
      JSON.stringify({ 'index.html': 'sha512hash' }, null, 2),
      'utf8',
    );
    fs.writeFileSync(metadataPath, metadataBytes);

    let capturedCwd;
    let capturedArgs;
    let stagedMetadata;
    let stagedRelease;

    const execFileSyncImpl = (cmd, args, opts) => {
      assert.equal(cmd, 'oras');
      capturedCwd = opts.cwd;
      capturedArgs = args;
      stagedMetadata = fs.readFileSync(
        path.join(opts.cwd, 'base-metadata.json'),
      );
      stagedRelease = JSON.parse(
        fs.readFileSync(path.join(opts.cwd, 'base-release.json'), 'utf8'),
      );
      return '';
    };

    const result = pushBaseManifest({
      appVersion: '6.8.0',
      platform: 'desktop',
      metadataPath,
      sourceCommit: '0123456789abcdef',
      createdAt: '2026-11-18T12:00:00.000Z',
      execFileSyncImpl,
    });

    const expectedSha = crypto
      .createHash('sha256')
      .update(metadataBytes)
      .digest('hex');

    assert.equal(result.pushed, true);
    assert.equal(
      result.reference,
      'ghcr.io/onekeyhq/ota-base-bundle:v6.8.0-desktop',
    );
    assert.equal(result.metadataSha256, expectedSha);
    assert.equal(stagedMetadata.equals(metadataBytes), true);
    assert.deepEqual(stagedRelease, {
      schemaVersion: 1,
      appVersion: '6.8.0',
      platform: 'desktop',
      sourceCommit: '0123456789abcdef',
      metadataSha256: expectedSha,
      createdAt: '2026-11-18T12:00:00.000Z',
    });

    assert.ok(capturedArgs.includes('--artifact-type'));
    assert.ok(capturedArgs.includes(OCI_ARTIFACT_TYPE));
    assert.ok(
      capturedArgs.includes(
        'org.opencontainers.image.revision=0123456789abcdef',
      ),
    );
    assert.ok(
      capturedArgs.includes('ghcr.io/onekeyhq/ota-base-bundle:v6.8.0-desktop'),
    );
    assert.ok(
      capturedArgs.some((arg) => arg.startsWith('base-metadata.json:')),
    );
    assert.ok(capturedArgs.some((arg) => arg.startsWith('base-release.json:')));
    assert.equal(
      fs.existsSync(capturedCwd),
      false,
      'temporary staging dir should be removed after push',
    );
  }));

test('pushBaseManifest rejects invalid or empty metadata files', () =>
  withTempDir((tmpDir) => {
    const emptyFile = path.join(tmpDir, 'empty.json');
    fs.writeFileSync(emptyFile, '');
    assert.throws(
      () =>
        pushBaseManifest({
          appVersion: '6.8.0',
          platform: 'ios',
          metadataPath: emptyFile,
          execFileSyncImpl: () => '',
        }),
      /empty/,
    );

    const badJsonFile = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(badJsonFile, '{not-json');
    assert.throws(
      () =>
        pushBaseManifest({
          appVersion: '6.8.0',
          platform: 'ios',
          metadataPath: badJsonFile,
          execFileSyncImpl: () => '',
        }),
      /Invalid metadata JSON/,
    );
  }));

test('CLI subcommands work end-to-end', () => {
  const supported = execFileSync(
    process.execPath,
    [SCRIPT_PATH, 'is-supported', '--app-version', '6.8.0'],
    { encoding: 'utf8' },
  ).trim();
  assert.equal(supported, 'true');

  const unsupported = execFileSync(
    process.execPath,
    [SCRIPT_PATH, 'is-supported', '--app-version', '6.7.0'],
    { encoding: 'utf8' },
  ).trim();
  assert.equal(unsupported, 'false');

  const tag = execFileSync(
    process.execPath,
    [SCRIPT_PATH, 'tag', '--app-version', '6.8.0', '--platform', 'ios'],
    { encoding: 'utf8' },
  ).trim();
  assert.equal(tag, 'v6.8.0-ios');

  const ref = execFileSync(
    process.execPath,
    [
      SCRIPT_PATH,
      'reference',
      '--app-version',
      '6.8.0',
      '--platform',
      'android',
    ],
    { encoding: 'utf8' },
  ).trim();
  assert.equal(ref, 'ghcr.io/onekeyhq/ota-base-bundle:v6.8.0-android');

  const pullSkip = execFileSync(
    process.execPath,
    [
      SCRIPT_PATH,
      'pull',
      '--app-version',
      '6.7.5',
      '--platform',
      'desktop',
      '--output-dir',
      os.tmpdir(),
    ],
    { encoding: 'utf8' },
  );
  assert.equal(JSON.parse(pullSkip).skipped, true);

  assert.throws(
    () =>
      runCli([
        'push',
        '--app-version',
        '6.7.5',
        '--platform',
        'desktop',
        '--metadata-path',
        '/tmp/nonexistent',
      ]),
    /requires version >= 6\.8\.0/,
  );
});
