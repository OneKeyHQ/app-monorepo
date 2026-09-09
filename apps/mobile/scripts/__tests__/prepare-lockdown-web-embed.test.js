const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../../../development/lavamoat/smoke-web-embed.cjs', () => ({
  validateArtifact: () => ({ rawSes: 'verified-by-separate-artifact-tests' }),
}));

const {
  copyVerifiedFiles,
  prepareCandidateWebEmbed,
  readManifest,
  readVerifiedFiles,
} = require('../prepare-lockdown-web-embed');

const digest = (data) => crypto.createHash('sha256').update(data).digest('hex');
const runId = 'a'.repeat(32);

describe('explicit modern-engine native E2E assets', () => {
  let directory;
  let artifact;
  let manifestPath;
  let manifest;
  let env;
  let repoRoot;
  let checker;

  beforeEach(() => {
    directory = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'lockdown-candidate-')),
    );
    artifact = path.join(directory, 'artifact');
    repoRoot = path.join(directory, 'repo');
    manifestPath = path.join(directory, 'manifest.json');
    fs.mkdirSync(artifact);
    fs.mkdirSync(path.join(artifact, 'assets'));
    fs.writeFileSync(path.join(artifact, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(artifact, 'assets', 'app.js'), 'fixture');
    manifest = {
      'index.html': digest('<html></html>'),
      'assets/app.js': digest('fixture'),
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    env = {
      NODE_ENV: 'production',
      VERSION: '1.0.0',
      BUILD_NUMBER: '1',
      BUNDLE_VERSION: '1',
      ONEKEY_MOBILE_LOCKDOWN_E2E: runId,
      ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_ARTIFACT: artifact,
      ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_MANIFEST: manifestPath,
      ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_MANIFEST_SHA256: digest(
        fs.readFileSync(manifestPath),
      ),
    };
    checker = path.join(
      repoRoot,
      'apps/web-embed/scripts/check-browser-compat.js',
    );
    fs.mkdirSync(path.dirname(checker), { recursive: true });
    fs.writeFileSync(
      checker,
      "console.error('ses.js uses unsupported Chromium 67 syntax'); process.exitCode = 1;",
    );
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('normal builds do not inspect or change asset directories', () => {
    expect(prepareCandidateWebEmbed({ env: {}, repoRoot })).toBeUndefined();
    expect(fs.existsSync(path.join(repoRoot, 'apps/web-embed/web-build'))).toBe(
      false,
    );
  });

  test.each([
    { ONEKEY_MOBILE_LOCKDOWN_E2E: undefined },
    { ONEKEY_MOBILE_LOCKDOWN_E2E: '../invalid' },
    { ONEKEY_MOBILE_LOCKDOWN: 'false' },
    { NODE_ENV: 'development' },
    { ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_MANIFEST_SHA256: undefined },
  ])('rejects unauthorized or incomplete candidate mode: %j', (changes) => {
    expect(() =>
      prepareCandidateWebEmbed({ env: { ...env, ...changes }, repoRoot }),
    ).toThrow();
    expect(fs.existsSync(path.join(repoRoot, 'apps/web-embed/web-build'))).toBe(
      false,
    );
  });

  test('copies all exact bytes to both native assets and retains the failed existing baseline', () => {
    const report = prepareCandidateWebEmbed({ env, repoRoot });
    expect(report.releaseEligible).toBe(false);
    expect(report.existingChromium67Baseline.status).toBe('failed');
    expect(report.files).toEqual(manifest);
    for (const relative of [
      'apps/web-embed/web-build',
      'apps/mobile/android/app/src/main/assets/web-embed',
      'apps/mobile/ios/OneKeyWallet/web-embed',
    ]) {
      expect(
        [
          ...readVerifiedFiles(path.join(repoRoot, relative), manifest).keys(),
        ].toSorted(),
      ).toEqual(Object.keys(manifest).toSorted());
    }
    const receipt = path.join(
      repoRoot,
      `apps/mobile/out-dir-bundle/lockdown-web-embed-candidate-${runId}.json`,
    );
    expect(JSON.parse(fs.readFileSync(receipt, 'utf8'))).toEqual(report);
    expect(fs.statSync(receipt).mode & 0o777).toBe(0o600);
  });

  test('retains a successful baseline without declaring release eligibility', () => {
    fs.writeFileSync(
      checker,
      "console.log('Verified 2 assets for Chromium 67 syntax compatibility.');",
    );
    const report = prepareCandidateWebEmbed({ env, repoRoot });
    expect(report.existingChromium67Baseline.status).toBe('passed');
    expect(report.releaseEligible).toBe(false);
  });

  test('rejects an unexpected baseline checker crash', () => {
    fs.writeFileSync(checker, "throw new Error('fixture checker failure');");
    expect(() => prepareCandidateWebEmbed({ env, repoRoot })).toThrow(
      'failed unexpectedly',
    );
  });

  test('rejects changed manifest bytes', () => {
    expect(() => readManifest(manifestPath, '0'.repeat(64))).toThrow(
      'digest changed',
    );
  });

  test.each([
    '../escape',
    '/absolute',
    'a/../escape',
    'a\\escape',
    'source.js.map',
  ])('rejects unsafe manifest path %s', (filename) => {
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ ...manifest, [filename]: 'a'.repeat(64) }),
    );
    expect(() =>
      readManifest(manifestPath, digest(fs.readFileSync(manifestPath))),
    ).toThrow();
  });

  test('rejects missing, extra, or modified files', () => {
    const file = path.join(artifact, 'assets/app.js');
    fs.writeFileSync(file, 'modified');
    expect(() => readVerifiedFiles(artifact, manifest)).toThrow(
      'digest changed',
    );
    fs.rmSync(file);
    expect(() => readVerifiedFiles(artifact, manifest)).toThrow(
      'files are missing',
    );
    fs.writeFileSync(file, 'fixture');
    fs.writeFileSync(path.join(artifact, 'extra.js'), 'extra');
    expect(() => readVerifiedFiles(artifact, manifest)).toThrow('extra file');
  });

  test('rejects source, file, and destination symlinks', () => {
    const link = path.join(directory, 'link');
    fs.symlinkSync(artifact, link);
    expect(() => readVerifiedFiles(link, manifest)).toThrow('symbolic links');
    const file = path.join(artifact, 'assets/app.js');
    fs.rmSync(file);
    fs.symlinkSync(path.join(artifact, 'index.html'), file);
    expect(() => readVerifiedFiles(artifact, manifest)).toThrow(
      'symbolic links',
    );
    fs.rmSync(file);
    fs.writeFileSync(file, 'fixture');
    expect(() =>
      copyVerifiedFiles({
        directory: path.join(link, 'destination'),
        manifest,
        files: readVerifiedFiles(artifact, manifest),
      }),
    ).toThrow('symbolic links');
  });

  test('refuses a source overlapping generated destinations', () => {
    expect(() =>
      prepareCandidateWebEmbed({
        env,
        repoRoot: path.join(artifact, 'nested'),
      }),
    ).toThrow('independent');
  });
});
