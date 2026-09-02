const fs = require('fs');
const os = require('os');
const path = require('path');

const devVendorConfig = require('../../dev-vendor.config');
const {
  createIosDevShellInfoPlist,
  getIosBuildSettings,
  getNativeBuildEnvironment,
  parseArgs,
} = require('../build-mobile-dev-shell');

describe('build-mobile-dev-shell', () => {
  const repoRoot = path.resolve(__dirname, '../../../..');
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
    expect(androidBuildGradle).toContain(
      'buildConfigField("boolean", "ENABLE_NATIVE_BACKGROUND_THREAD", enableNativeBackgroundThread)',
    );
    expect(androidBuildGradle).toContain(
      "(useDevShell ? 'true' : enableNativeBackgroundThread)",
    );
  });

  it('injects the iOS contract through dev-shell-only build configuration', () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-ios-dev-shell-info-test-'),
    );
    try {
      const outputPath = path.join(temporaryDirectory, 'Info.plist');
      createIosDevShellInfoPlist({
        nativeContractKey: 'a'.repeat(64),
        outputPath,
      });
      const productionInfo = fs.readFileSync(
        path.join(repoRoot, 'apps/mobile/ios/OneKeyWallet/Info.plist'),
        'utf8',
      );
      const devShellInfo = fs.readFileSync(outputPath, 'utf8');

      for (const key of [
        'ONEKEY_DEV_BG_HMR',
        'ONEKEY_DEV_VENDOR_SCHEMA_VERSION',
        'ONEKEY_DEV_VENDOR_STRATEGY_VERSION',
        'ONEKEY_NATIVE_CONTRACT_KEY',
      ]) {
        expect(productionInfo).not.toContain(`<key>${key}</key>`);
        expect(devShellInfo).toContain(`<key>${key}</key>`);
      }
      expect(devShellInfo).toContain(
        `<integer>${devVendorConfig.SCHEMA_VERSION}</integer>`,
      );
      expect(devShellInfo).toContain(
        `<integer>${devVendorConfig.STRATEGY_VERSION}</integer>`,
      );
      expect(devShellInfo).toContain(`<string>${'a'.repeat(64)}</string>`);
      expect(getIosBuildSettings(outputPath)).toEqual([
        // cspell:disable-next-line
        `INFOPLIST_FILE=${outputPath}`,
        'SWIFT_ACTIVE_COMPILATION_CONDITIONS=$(inherited) DEBUG ONEKEY_DEV_SHELL',
      ]);
    } finally {
      fs.rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it('serializes x-only platform publishing with exact and compatible locators', () => {
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
      expect(source).toContain("github.ref != 'refs/heads/x'");
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
