const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '../..');
const SIGNING_INPUTS = [
  'ASC_API_KEY',
  'CREDENTIALS_JSON',
  'DIST_CERT_P12',
  'ADHOC_PROFILE',
  'ADHOC_SERVICE_EXTENSION_PROFILE',
  'ADHOC_APP_CLIP_PROFILE',
  'APPSTORE_PROFILE',
  'APPSTORE_SERVICE_EXTENSION_PROFILE',
  'APPSTORE_APP_CLIP_PROFILE',
];
const SIGNING_FILES = [
  'AscApiKey.p8',
  'credentials.json',
  'ios/certs/dist.p12',
  'ios/certs/profile.mobileprovision',
  'ios/certs/serviceextension-profile.mobileprovision',
  'ios/certs/appclip-profile.mobileprovision',
];

function runRelease(t, platform, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-mobile-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const script = path.join(root, '.github/scripts/mobile-release.sh');
  const cli = path.join(
    root,
    '.github/tools/eas-cli/node_modules/eas-cli/bin/run',
  );
  const mobile = path.join(root, 'apps/mobile');
  for (const dir of [path.dirname(script), path.dirname(cli), mobile])
    fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, '.github/scripts/mobile-release.sh'), script);
  fs.writeFileSync(
    cli,
    `
    const fs = require('node:fs');
    const files = ${JSON.stringify(SIGNING_FILES)};
    const inputs = ${JSON.stringify(SIGNING_INPUTS)};
    const record = {
      args: process.argv.slice(2),
      expoTokenPresent: Boolean(process.env.EXPO_TOKEN),
      signingInputs: inputs.filter(name => process.env[name]),
      files: Object.fromEntries(files.filter(name => fs.existsSync(name)).map(name => [name, {
        text: fs.readFileSync(name, 'utf8'), mode: fs.statSync(name).mode & 0o777,
      }])),
    };
    fs.appendFileSync(process.env.RECORD, JSON.stringify(record) + '\\n');
    process.exitCode = process.env.FAIL_EAS === 'true' ? 17 : 0;
  `,
  );
  const env = {
    ...process.env,
    PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}`,
    RECORD: path.join(root, 'calls.jsonl'),
    EXPO_TOKEN: 'fixture-expo-token',
    IS_WORKFLOW_RUN: 'false',
    ENABLE_STARTUP_PROFILE: 'false',
    ONEKEY_ALLOW_SKIP_GPG_VERIFICATION: 'false',
    WORKFLOW_BUILD_NUMBER: '',
    FAIL_EAS: 'false',
  };
  for (const name of SIGNING_INPUTS)
    env[name] = Buffer.from(`fixture-${name}`).toString('base64');
  env.CREDENTIALS_JSON = Buffer.from(
    JSON.stringify({
      ios: {
        OneKeyWallet: {
          distributionCertificate: {
            path: 'ios/certs/dist.p12',
            password: 'fixture-password',
          },
        },
      },
    }),
  ).toString('base64');
  const result = spawnSync('bash', [script, platform], {
    cwd: root,
    env: { ...env, ...overrides },
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.ifError(result.error);
  const calls = fs.existsSync(env.RECORD)
    ? fs
        .readFileSync(env.RECORD, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    : [];
  for (const name of SIGNING_FILES)
    assert.equal(
      fs.existsSync(path.join(mobile, name)),
      false,
      `cleaned ${name}`,
    );
  for (const call of calls) {
    assert.equal(call.expoTokenPresent, true);
    assert.deepEqual(call.signingInputs, []);
  }
  assert.doesNotMatch(
    result.stdout + result.stderr,
    /fixture-(?:password|expo-token|ASC_API_KEY)/u,
  );
  return { result, calls };
}

for (const [name, env, profiles] of [
  ['manual production', {}, ['production']],
  [
    'manual QA',
    { ONEKEY_ALLOW_SKIP_GPG_VERIFICATION: 'true' },
    ['qa-internal'],
  ],
  [
    'startup profiling',
    { ENABLE_STARTUP_PROFILE: 'true' },
    ['qa-internal-startup-profile'],
  ],
  [
    'development workflow',
    { IS_WORKFLOW_RUN: 'true', WORKFLOW_BUILD_NUMBER: '1000123' },
    ['production'],
  ],
  [
    'store workflow',
    { IS_WORKFLOW_RUN: 'true', WORKFLOW_BUILD_NUMBER: '2026110901' },
    ['production-store'],
  ],
  [
    'QA store workflow',
    { IS_WORKFLOW_RUN: 'true', ONEKEY_ALLOW_SKIP_GPG_VERIFICATION: 'true' },
    ['qa-internal-store'],
  ],
]) {
  for (const platform of ['ios', 'android']) {
    test(`${platform} preserves ${name} profiles and cleans credentials`, (t) => {
      const { result, calls } = runRelease(t, platform, env);
      assert.equal(result.status, 0, result.stderr);
      const expected =
        platform === 'android' && profiles[0].endsWith('-store')
          ? [profiles[0].replace('-store', ''), ...profiles]
          : profiles;
      assert.deepEqual(
        calls.map((call) =>
          call.args.find((arg) => arg.startsWith('--profile=')),
        ),
        expected.map((p) => `--profile=${p}`),
      );
      for (const call of calls) {
        assert.equal(
          call.args.includes('--auto-submit'),
          call.args.some((arg) => arg.endsWith('-store')),
        );
        assert.equal(
          call.args.includes('--resource-class'),
          platform === 'android',
        );
        assert.equal(call.args.includes('--no-wait'), true);
        if (platform === 'ios') {
          assert.deepEqual(Object.keys(call.files), SIGNING_FILES);
          for (const file of Object.values(call.files))
            assert.equal(file.mode, 0o600);
          const store = expected[0].endsWith('-store');
          assert.equal(
            call.files['ios/certs/profile.mobileprovision'].text,
            `fixture-${store ? 'APPSTORE' : 'ADHOC'}_PROFILE`,
          );
          const credentials = JSON.parse(
            call.files['credentials.json'].text,
          ).ios;
          assert.deepEqual(
            credentials.OneKeyAppClip.distributionCertificate,
            credentials.OneKeyWallet.distributionCertificate,
          );
          assert.equal(
            credentials.OneKeyAppClip.provisioningProfilePath,
            'ios/certs/appclip-profile.mobileprovision',
          );
        }
      }
    });
  }
}

test('cleans partial credentials when a required secret is missing', (t) => {
  const { result, calls } = runRelease(t, 'ios', { DIST_CERT_P12: '' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing DIST_CERT_P12/u);
  assert.deepEqual(calls, []);
});

test('cleans credentials and preserves a failed EAS exit status', (t) => {
  const { result, calls } = runRelease(t, 'ios', { FAIL_EAS: 'true' });
  assert.equal(result.status, 17);
  assert.equal(calls.length, 1);
});

test('does not submit Android after the internal build fails', (t) => {
  const { result, calls } = runRelease(t, 'android', {
    IS_WORKFLOW_RUN: 'true',
    FAIL_EAS: 'true',
  });
  assert.equal(result.status, 17);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.includes('--auto-submit'), false);
});

for (const platform of ['ios', 'android']) {
  test(`${platform} installs tools before exposing Expo/signing secrets`, () => {
    const workflow = YAML.parse(
      fs.readFileSync(
        path.join(ROOT, `.github/workflows/release-${platform}.yml`),
        'utf8',
      ),
    );
    const steps = workflow.jobs[`release-${platform}`].steps;
    const install = steps.findIndex(
      (step) => step.name === 'Install locked EAS CLI',
    );
    const build = steps.findIndex((step) => step.name === 'Build on EAS');
    assert.ok(install >= 0 && build > install);
    assert.ok(steps.findIndex((step) => step.name === 'Install Dep') < install);
    assert.match(steps[install].run, /install --immutable$/u);
    assert.equal(
      steps[build].run,
      `bash .github/scripts/mobile-release.sh ${platform}`,
    );
    assert.match(steps[build].env.EXPO_TOKEN, /secrets\.EXPO_TOKEN/u);
    for (const step of steps.slice(0, build)) {
      const text = YAML.stringify(step);
      assert.doesNotMatch(
        text,
        /secrets\.(?:EXPO_TOKEN|ASC_API_KEY|CREDENTIALS_JSON|DIST_CERT_P12|ADHOC_|APPSTORE_)/u,
      );
    }
    if (platform === 'ios') {
      assert.equal(
        steps.find((step) => step.name === 'Clean up signing credentials').if,
        'always()',
      );
    }
  });
}
