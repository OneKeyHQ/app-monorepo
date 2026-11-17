const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const AdmZip = require('adm-zip');

const {
  createBuildManifest,
  prepareEnvironment,
  validateManifest,
  fixedEnvironment,
  getCommit,
  packageFirefox,
  sha256,
} = require('../lib/firefox-build');

function manifest() {
  return createBuildManifest({
    ...fixedEnvironment,
    VERSION: '6.8.0',
    BUILD_TIME: '1794895200000',
    BUILD_NUMBER: '1',
    BUNDLE_VERSION: '27670002',
    GITHUB_SHA: getCommit({}),
  });
}

describe('Firefox release inputs', () => {
  it('records only client-visible inputs and preserves absent versus empty values', () => {
    const result = createBuildManifest({
      ...manifest().environment,
      ...fixedEnvironment,
      EXT_INJECT_MODE: '',
      SENTRY_AUTH_TOKEN: 'must-not-ship',
    });
    expect(result.environment.EXT_INJECT_MODE).toBe('');
    expect(result.environment.ONEKEY_BUILD_TYPE).toBeNull();
    expect(result.environment).not.toHaveProperty('SENTRY_AUTH_TOKEN');
    expect(JSON.stringify(result)).not.toContain('must-not-ship');
    expect(() => validateManifest(result)).not.toThrow();
  });
  it('drops unrelated CI switches and credentials before installation and compilation', () => {
    const env = {
      PATH: '/usr/bin',
      EAS_BUILD: '1',
      PERF_MONITOR_ALL_PACKAGES: '1',
      COVALENT_KEY: 'must-not-ship',
      SENTRY_DSN_DESKTOP: 'must-not-ship',
      SENTRY_AUTH_TOKEN: 'must-not-ship',
      SENTRY_DSN_EXT: 'public-extension-dsn',
    };
    prepareEnvironment(env);
    expect(env.PATH).toBe('/usr/bin');
    expect(env.SENTRY_DSN_EXT).toBe('public-extension-dsn');
    expect(env.EXT_CHANNEL).toBe('firefox');
    expect(JSON.stringify(env)).not.toContain('must-not-ship');
    expect(env).not.toHaveProperty('EAS_BUILD');
    expect(env).not.toHaveProperty('PERF_MONITOR_ALL_PACKAGES');
  });
  it('rejects wrong toolchains, lockfiles, conflicting commits and unrecognized environment keys', () => {
    for (const change of [
      (m) => {
        m.environment.VERSION = '../../escape';
      },
      (m) => {
        m.environment.BUILD_TIME = '0000000000001';
      },
      (m) => {
        m.nodeVersion = 'v0.0.0';
      },
      (m) => {
        m.yarnLockSha256 = 'different';
      },
      (m) => {
        m.environment.WORKFLOW_GITHUB_SHA = 'f'.repeat(40);
      },
      (m) => {
        m.environment.SENTRY_AUTH_TOKEN = 'unexpected';
      },
      (m) => {
        m.environment.BUILD_TIME = '1794895200';
      },
      (m) => {
        m.environment.EXT_CHANNEL = 'chrome';
      },
    ]) {
      const result = manifest();
      change(result);
      expect(() => validateManifest(result)).toThrow();
    }
  });
});

describe('Firefox packaging', () => {
  let root;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'firefox-package-'));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  it('produces identical ZIPs across source permissions, file times, creation order and timezone', () => {
    const previousTimezone = process.env.TZ;
    try {
      const hashes = [];
      for (const [index, timezone] of [
        'UTC',
        'America/Los_Angeles',
      ].entries()) {
        process.env.TZ = timezone;
        const input = path.join(root, `input-${index}`),
          output = path.join(root, `dist-${index}`);
        fs.mkdirSync(input);
        fs.writeFileSync(
          path.join(input, 'firefox-build.json'),
          `${JSON.stringify(manifest(), null, 2)}\n`,
        );
        for (const name of index ? ['Z.js', 'a.js'] : ['a.js', 'Z.js']) {
          const file = path.join(input, name);
          fs.writeFileSync(file, 'same bytes');
          fs.chmodSync(file, index ? 0o755 : 0o644);
          fs.utimesSync(
            file,
            index ? 1_234_567_890 : 1_500_000_000,
            index ? 1_234_567_890 : 1_500_000_000,
          );
        }
        const original = fs.readFileSync(path.join(input, 'a.js'));
        const archivePath = packageFirefox(input, output);
        const archive = new AdmZip(archivePath);
        expect(archive.readFile('a.js')).toEqual(original);
        expect(fs.readFileSync(path.join(input, 'a.js'))).toEqual(original);
        expect(archive.readAsText('firefox-build.json')).toBe(
          fs.readFileSync(path.join(output, 'firefox-build.json'), 'utf8'),
        );
        expect(
          fs.readFileSync(path.join(output, 'firefox-files.sha256'), 'utf8'),
        ).toContain(`${sha256(original)}  a.js`);
        hashes.push(sha256(fs.readFileSync(archivePath)));
      }
      expect(hashes[0]).toBe(hashes[1]);
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });
});
