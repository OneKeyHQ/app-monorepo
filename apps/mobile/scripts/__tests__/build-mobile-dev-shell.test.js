/* cspell:words podspec podspecs */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  spawnSync: jest.fn(),
}));

const devVendorConfig = require('../../dev-vendor.config');
const {
  assertIosProductionInfoPlistIsolated,
  getIosBuildSettings,
  getIosDevShellInfoPlistEntries,
  getNativeBuildEnvironment,
  injectIosDevShellInfoPlist,
  packageIosSimulatorApp,
  parseArgs,
  refreshStaleIosPodspecs,
} = require('../build-mobile-dev-shell');

describe('build-mobile-dev-shell', () => {
  const repoRoot = path.resolve(__dirname, '../../../..');

  beforeEach(() => {
    jest.resetAllMocks();
    spawnSync.mockReturnValue({ status: 0, stdout: '' });
  });

  it.each([false, true])(
    'packages only the final signed simulator app (verification fails: %s)',
    (verificationFails) => {
      const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'onekey-signed-package-test-'),
      );
      const appDirectory = path.join(directory, 'OneKeyWallet.app');
      const artifactPath = path.join(directory, 'shell.zip');
      fs.mkdirSync(appDirectory);
      fs.writeFileSync(
        path.join(appDirectory, 'Info.plist'),
        '<?xml version="1.0"?><plist/>',
      );
      let plistFinalized = false;
      spawnSync.mockImplementation((command, args) => {
        if (command === '/usr/bin/plutil' && args[0] === '-lint')
          plistFinalized = true;
        if (command === 'lipo') return { status: 0, stdout: 'arm64' };
        if (command === 'xcrun') {
          return {
            status: 0,
            stdout: 'sectname __entitlements\n  segname __TEXT\n',
          };
        }
        if (command === 'codesign') {
          expect(plistFinalized).toBe(true);
          expect(args).not.toContain('--entitlements');
          if (args.includes('--verify') && verificationFails)
            return { status: 1 };
        }
        return { status: 0 };
      });
      try {
        const pack = () =>
          packageIosSimulatorApp({
            appDirectory,
            artifactPath,
            nativeContractKey: 'a'.repeat(64),
          });
        if (verificationFails) {
          expect(pack).toThrow('Command failed: codesign');
          expect(
            spawnSync.mock.calls.some(([command]) => command === 'ditto'),
          ).toBe(false);
        } else {
          pack();
          expect(spawnSync.mock.calls.at(-1)).toEqual([
            'ditto',
            [
              '-c',
              '-k',
              '--sequesterRsrc',
              '--keepParent',
              appDirectory,
              artifactPath,
            ],
            expect.any(Object),
          ]);
          expect(spawnSync).toHaveBeenCalledWith(
            'codesign',
            ['--verify', '--deep', '--strict', appDirectory],
            expect.any(Object),
          );
        }
      } finally {
        fs.rmSync(directory, { force: true, recursive: true });
      }
    },
  );

  it('refreshes obsolete external podspec caches without changing dependency locks', () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-podspec-test-'),
    );
    const specs = path.join(directory, 'Pods/Local Podspecs');
    fs.mkdirSync(specs, { recursive: true });
    const lock = `EXTERNAL SOURCES:
  hermes-engine:
    :podspec: ../../../node_modules/hermes-engine.podspec
  ReactNativeDependencies:
    :podspec: ../../../node_modules/ReactNativeDependencies.podspec
  LocalModule:
    :path: ../../../node_modules/local-module
SPEC CHECKSUMS:
  hermes-engine: current-hermes
  ReactNativeDependencies: current-dependencies
  LocalModule: current-local
`;
    fs.writeFileSync(path.join(directory, 'Podfile.lock'), lock);
    fs.writeFileSync(
      path.join(directory, 'Pods/Manifest.lock'),
      lock.replace('current-hermes', 'old-hermes'),
    );
    for (const name of [
      'hermes-engine',
      'ReactNativeDependencies',
      'LocalModule',
    ]) {
      fs.writeFileSync(path.join(specs, `${name}.podspec.json`), '{}');
    }
    try {
      refreshStaleIosPodspecs(directory);
      expect(
        fs.existsSync(path.join(specs, 'hermes-engine.podspec.json')),
      ).toBe(false);
      expect(
        fs.existsSync(path.join(specs, 'ReactNativeDependencies.podspec.json')),
      ).toBe(true);
      expect(fs.existsSync(path.join(specs, 'LocalModule.podspec.json'))).toBe(
        true,
      );
      expect(
        fs.readFileSync(path.join(directory, 'Podfile.lock'), 'utf8'),
      ).toBe(lock);
    } finally {
      fs.rmSync(directory, { force: true, recursive: true });
    }
  });

  it('parses one platform build without combining native targets', () => {
    expect(
      parseArgs([
        'build',
        '--platform',
        'ios',
        '--output',
        '/tmp/onekey-shell',
        '--result',
        '/tmp/onekey-shell-result.json',
        '--skip-pods',
      ]),
    ).toEqual({
      outputDirectory: '/tmp/onekey-shell',
      platform: 'ios',
      resultPath: '/tmp/onekey-shell-result.json',
      skipPods: true,
    });
  });

  it('rejects a combined or unsupported platform', () => {
    expect(() => parseArgs(['build', '--platform', 'all'])).toThrow(
      '--platform must be android or ios',
    );
  });

  it('keeps dev shell builds neutral to caller native feature flags', () => {
    expect(
      getNativeBuildEnvironment({
        ANDROID_CHANNEL: 'googleplay',
        NODE_ENV: 'test',
        ONEKEY_DEV_BG_HMR: 'true',
        ONEKEY_DEV_VENDOR: 'true',
        ONEKEY_STARTUP_PROFILE: 'true',
      }),
    ).toEqual({
      ANDROID_CHANNEL: 'direct',
      ENABLE_NATIVE_BACKGROUND_THREAD: 'true',
      NODE_ENV: 'production',
      ONEKEY_DEV_BG_HMR: 'false',
      ONEKEY_DEV_SHELL: 'true',
      ONEKEY_DEV_VENDOR: 'false',
      ONEKEY_STARTUP_PROFILE: 'false',
      SENTRY_DISABLE_AUTO_UPLOAD: 'true',
    });

    const androidBuildGradle = fs.readFileSync(
      path.join(repoRoot, 'apps/mobile/android/app/build.gradle'),
      'utf8',
    );
    expect(androidBuildGradle).toContain(
      "defEnvStr(appEnvConfig, 'ENABLE_NATIVE_BACKGROUND_THREAD', 'false').toLowerCase()",
    );
    const variableDeclarationIndex = androidBuildGradle.indexOf(
      'def enableNativeBackgroundThread =',
    );
    expect(variableDeclarationIndex).toBeGreaterThan(-1);
    expect(variableDeclarationIndex).toBeLessThan(
      androidBuildGradle.indexOf('android {'),
    );
    expect(
      androidBuildGradle.indexOf(
        'def enableNativeBackgroundThread =',
        variableDeclarationIndex + 1,
      ),
    ).toBe(-1);
    expect(androidBuildGradle).toContain(
      'buildConfigField("boolean", "ENABLE_NATIVE_BACKGROUND_THREAD", enableNativeBackgroundThread)',
    );
    expect(androidBuildGradle).toContain(
      "(useDevShell ? 'true' : enableNativeBackgroundThread)",
    );
    expect(androidBuildGradle).toContain(
      "BUILTIN_BUNDLE_VERSION: (useDevShell ? '0' : defEnvStr(appEnvConfig, 'BUNDLE_VERSION'))",
    );
  });

  it('injects the iOS contract only into the built app Info.plist', () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-ios-dev-shell-info-test-'),
    );
    try {
      const infoPlistPath = path.join(temporaryDirectory, 'Info.plist');
      fs.writeFileSync(infoPlistPath, '<?xml version="1.0"?><plist/>');
      const productionInfo = fs.readFileSync(
        path.join(repoRoot, 'apps/mobile/ios/OneKeyWallet/Info.plist'),
        'utf8',
      );
      const serviceExtensionInfo = fs.readFileSync(
        path.join(repoRoot, 'apps/mobile/ios/ServiceExtension/Info.plist'),
        'utf8',
      );

      assertIosProductionInfoPlistIsolated();
      const keys = [
        'ONEKEY_DEV_BG_HMR',
        'ONEKEY_DEV_VENDOR_SCHEMA_VERSION',
        'ONEKEY_DEV_VENDOR_STRATEGY_VERSION',
        'ONEKEY_NATIVE_CONTRACT_KEY',
      ];
      for (const key of keys) {
        expect(productionInfo).not.toContain(`<key>${key}</key>`);
      }
      expect(serviceExtensionInfo).toContain('<key>NSExtension</key>');
      expect(getIosBuildSettings()).toEqual([
        'SWIFT_ACTIVE_COMPILATION_CONDITIONS=$(inherited) DEBUG ONEKEY_DEV_SHELL',
        'CODE_SIGNING_ALLOWED=YES',
        'CODE_SIGN_IDENTITY=-',
      ]);
      expect(getIosDevShellInfoPlistEntries('a'.repeat(64))).toEqual([
        ['ONEKEY_DEV_BG_HMR', 'bool', 'false'],
        [
          'ONEKEY_DEV_VENDOR_SCHEMA_VERSION',
          'integer',
          String(devVendorConfig.SCHEMA_VERSION),
        ],
        [
          'ONEKEY_DEV_VENDOR_STRATEGY_VERSION',
          'integer',
          String(devVendorConfig.STRATEGY_VERSION),
        ],
        ['ONEKEY_NATIVE_CONTRACT_KEY', 'string', 'a'.repeat(64)],
      ]);

      injectIosDevShellInfoPlist({
        appDirectory: temporaryDirectory,
        nativeContractKey: 'a'.repeat(64),
      });
      expect(spawnSync).toHaveBeenCalledTimes(5);
      for (const call of spawnSync.mock.calls) {
        expect(call[1].at(-1)).toBe(infoPlistPath);
        expect(call[1].join(' ')).not.toContain('ServiceExtension');
      }
      expect(spawnSync).toHaveBeenLastCalledWith(
        '/usr/bin/plutil',
        ['-lint', infoPlistPath],
        expect.objectContaining({ stdio: 'inherit' }),
      );
      expect(() =>
        getIosDevShellInfoPlistEntries('<invalid-native-contract-key>'),
      ).toThrow('Invalid iOS native contract key');
    } finally {
      fs.rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it('serializes x-only publishing with branch dispatch builds', () => {
    for (const [platform, workflow] of [
      ['android', 'mobile-dev-shell-android.yml'],
      ['ios-simulator', 'mobile-dev-shell-ios-simulator.yml'],
    ]) {
      const source = fs.readFileSync(
        path.join(repoRoot, '.github/workflows', workflow),
        'utf8',
      );
      expect(source).toContain(
        `group: mobile-dev-shell-${platform}-${'$'}{{ github.ref }}`,
      );
      expect(source).toContain('push:\n    branches:\n      - x\n    paths:');
      expect(source).toContain("- 'apps/mobile/package.json'");
      expect(source).toContain("- 'apps/mobile/dev-vendor.config.js'");
      expect(source).toContain("- 'patches/**'");
      expect(source).toContain("- 'yarn.lock'");
      expect(source).not.toContain('workflow_run:');
      expect(source).toContain(
        platform === 'android'
          ? "- 'apps/mobile/android/**'"
          : "- 'apps/mobile/ios/**'",
      );
      expect(source).toContain("github.ref != 'refs/heads/x'");
      expect(source).toContain("github.event_name != 'workflow_dispatch'");
      expect(source).toContain(
        `- name: Publish ${platform === 'android' ? 'Android' : 'iOS Simulator'} dev shell to GHCR\n        if: ${'$'}{{ github.ref == 'refs/heads/x' }}`,
      );
      expect(source).toContain(
        `exact_tag: ${'$'}{{ steps.artifact.outputs.exact_tag }}`,
      );
      expect(source).toContain(
        `compatibility_tag: ${'$'}{{ steps.artifact.outputs.compatibility_tag }}`,
      );
    }

    const action = fs.readFileSync(
      path.join(
        repoRoot,
        '.github/actions/publish-mobile-dev-shell/action.yml',
      ),
      'utf8',
    );
    expect(
      action.indexOf('artifact_manifest="$(oras manifest fetch'),
    ).toBeLessThan(action.indexOf('exact_manifest="$(oras manifest fetch'));
    expect(
      action.indexOf('exact_manifest="$(oras manifest fetch'),
    ).toBeLessThan(
      action.indexOf('compatibility_manifest="$(oras manifest fetch'),
    );
    expect(action).toContain('push_shell_manifest "$artifact_reference"');
    expect(action).toContain('oras tag "$artifact_reference" "$EXACT_TAG"');
    expect(action).toContain(
      'oras tag "$artifact_reference" "$COMPATIBILITY_TAG"',
    );
    expect(action).not.toContain('push_shell_manifest "$exact_reference"');
  });
});
