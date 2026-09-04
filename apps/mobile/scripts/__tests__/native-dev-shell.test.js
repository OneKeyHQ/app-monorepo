const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  addFallbackNotice,
  addFailureNotice,
  addSessionRenewalNotice,
  acquireNamedLock,
  acquireMetroPort,
  acquireWorktreePreparationLock,
  assertTargetDeviceArchitecture,
  configureDeviceMetro,
  createRenewedDevSession,
  createSessionId,
  createRunReport,
  getAndroidPrivateSessionInstallArgs,
  getAndroidLocalBuildEnvironment,
  getAndroidPrivateSessionRenewalArgs,
  getContractManifest,
  getNativeRuntimeBundleUrl,
  getShellArtifactTag,
  getShellCompatibility,
  launchNativeApp,
  parseAndroidDevices,
  parseArgs,
  parseIosSimulators,
  parseMetroBaseUrl,
  parseMetroPort,
  prewarmNativeRuntimeBundles,
  printRunSummary,
  pruneSessionDirectories,
  quoteAdbShellArgument,
  renewPrivateSession,
  selectTargetDevice,
  waitForNativeAppStartup,
  waitForMetroCompletionWithSessionRenewal,
  writeArtifactManifest,
} = require('../native-dev-shell');

function createDevSession({
  deviceId,
  platform,
  sessionId,
  worktreeId = '111111111111',
}) {
  return {
    deviceId,
    expiresAt: new Date(12 * 60 * 60 * 1000).toISOString(),
    expiresAtEpochMs: 12 * 60 * 60 * 1000,
    metro: { baseUrl: 'http://127.0.0.1:8081' },
    nativeContractKey: '1'.repeat(64),
    platform,
    schemaVersion: 2,
    sessionId,
    vendor: {},
    worktreeId,
  };
}

function stripSwiftDevShellBlocks(source) {
  const output = [];
  let excludedDepth = 0;
  for (const line of source.split('\n')) {
    if (/^\s*#if\b/u.test(line)) {
      if (excludedDepth > 0 || line.includes('ONEKEY_DEV_SHELL')) {
        excludedDepth += 1;
      } else {
        output.push(line);
      }
    } else if (/^\s*#endif\b/u.test(line) && excludedDepth > 0) {
      excludedDepth -= 1;
    } else if (excludedDepth === 0) {
      output.push(line);
    }
  }
  return output.join('\n');
}

function createCurrentSession(session) {
  return {
    deviceId: session.deviceId,
    schemaVersion: 1,
    sessionId: session.sessionId,
    worktreeId: session.worktreeId,
  };
}

function writeReclaimMarker({ lockDirectory, mainOwnerToken, pid, token }) {
  const stat = fs.statSync(lockDirectory);
  const markerDirectory = path.join(lockDirectory, '.reclaim');
  fs.mkdirSync(markerDirectory);
  fs.writeFileSync(
    path.join(markerDirectory, 'owner.json'),
    `${JSON.stringify({
      mainOwnerToken,
      pid,
      rootIdentity: `${String(stat.dev)}:${String(stat.ino)}`,
      token,
    })}\n`,
  );
  return markerDirectory;
}

describe('native-dev-shell', () => {
  let temporaryDirectory;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-native-dev-shell-test-'),
    );
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  });

  it('normalizes a device-visible Metro origin', () => {
    expect(parseMetroBaseUrl('http://192.168.1.5:8081/')).toBe(
      'http://192.168.1.5:8081',
    );
    expect(parseMetroBaseUrl('https://metro.example.com')).toBe(
      'https://metro.example.com',
    );
  });

  it('parses the unified app command resource policies', () => {
    expect(
      parseArgs([
        'launch',
        '--platform',
        'android',
        '--shell',
        'remote',
        '--vendor',
        'local',
        '--device',
        'emulator-5554',
        '--metro-url',
        'http://10.0.2.2:8081',
        '--metro-port',
        '8082',
      ]),
    ).toMatchObject({
      command: 'launch',
      device: 'emulator-5554',
      metroPort: '8082',
      metroUrl: 'http://10.0.2.2:8081',
      platform: 'android',
      shell: 'remote',
      vendor: 'local',
    });
  });

  it('keeps worktree and device identity in a unique runtime session ID', () => {
    const sessionId = createSessionId({
      deviceId: 'emulator-5554',
      randomBytes: () => Buffer.from('0011223344556677', 'hex'),
    });

    expect(sessionId).toMatch(
      /^wk-[0-9a-f]{12}-dev-[0-9a-f]{12}-0011223344556677$/u,
    );
  });

  it('selects a sole device and rejects ambiguous implicit selection', () => {
    const candidates = [
      { id: 'emulator-5554', name: 'Pixel A' },
      { id: 'emulator-5556', name: 'Pixel B' },
    ];

    expect(
      selectTargetDevice({
        candidates: [candidates[0]],
        platform: 'android',
      }),
    ).toEqual(candidates[0]);
    expect(() =>
      selectTargetDevice({ candidates, platform: 'android' }),
    ).toThrow('--device is required');
    expect(
      selectTargetDevice({
        candidates,
        platform: 'android',
        requestedDevice: 'emulator-5556',
      }),
    ).toEqual(candidates[1]);
  });

  it('parses only usable Android and booted iOS devices', () => {
    expect(
      parseAndroidDevices(
        'List of devices attached\nemulator-5554 device product:sdk\nemulator-5556 offline\n',
      ),
    ).toEqual([{ id: 'emulator-5554', name: 'emulator-5554' }]);
    expect(
      parseIosSimulators(
        JSON.stringify({
          devices: {
            runtime: [
              {
                isAvailable: true,
                name: 'iPhone A',
                state: 'Booted',
                udid: 'A',
              },
              {
                isAvailable: true,
                name: 'iPhone B',
                state: 'Shutdown',
                udid: 'B',
              },
            ],
          },
        }),
      ),
    ).toEqual([{ id: 'A', name: 'iPhone A' }]);
  });

  it('accepts only targets that can run the published shell architecture', () => {
    const androidOutput = jest.fn(() => 'arm64-v8a,armeabi-v7a');
    expect(() =>
      assertTargetDeviceArchitecture({
        deviceId: 'physical-device-1',
        platform: 'android',
        runForOutputCommand: androidOutput,
      }),
    ).not.toThrow();
    expect(androidOutput).toHaveBeenCalledWith('adb', [
      '-s',
      'physical-device-1',
      'shell',
      'getprop',
      'ro.product.cpu.abilist',
    ]);

    const iosOutput = jest.fn(() => 'arm64');
    expect(() =>
      assertTargetDeviceArchitecture({
        deviceId: 'SIMULATOR-A',
        platform: 'ios',
        runForOutputCommand: iosOutput,
      }),
    ).not.toThrow();
    expect(iosOutput).toHaveBeenCalledWith('xcrun', [
      'simctl',
      'spawn',
      'SIMULATOR-A',
      'uname',
      '-m',
    ]);
  });

  it('rejects x86 targets before shell preparation', () => {
    expect(() =>
      assertTargetDeviceArchitecture({
        deviceId: 'emulator-5554',
        platform: 'android',
        runForOutputCommand: () => 'x86_64,x86',
      }),
    ).toThrow('cannot run the arm64-v8a development shell');
    expect(() =>
      assertTargetDeviceArchitecture({
        deviceId: 'SIMULATOR-X86',
        platform: 'ios',
        runForOutputCommand: () => 'x86_64',
      }),
    ).toThrow('cannot run the arm64 development shell');

    const source = fs.readFileSync(
      path.join(__dirname, '../native-dev-shell.js'),
      'utf8',
    );
    const launchSource = source.slice(
      source.indexOf('async function launchDevShell('),
    );
    expect(
      launchSource.indexOf('assertTargetDeviceArchitecture({'),
    ).toBeLessThan(launchSource.indexOf('acquireNamedLock({'));
  });

  it('uses device-scoped adb reverse only for a physical Android default route', () => {
    const runCheckedCommand = jest.fn();
    const runBestEffortCommand = jest.fn();
    const runForOutputCommand = jest.fn(() => '0');
    const physical = configureDeviceMetro({
      deviceId: 'physical-device-1',
      metroPort: 8083,
      platform: 'android',
      runBestEffortCommand,
      runCheckedCommand,
      runForOutputCommand,
    });

    expect(physical.metroUrl).toBe('http://127.0.0.1:8083');
    expect(runForOutputCommand).toHaveBeenCalledWith('adb', [
      '-s',
      'physical-device-1',
      'shell',
      'getprop',
      'ro.kernel.qemu',
    ]);
    expect(runForOutputCommand).toHaveBeenCalledWith('adb', [
      '-s',
      'physical-device-1',
      'reverse',
      '--list',
    ]);
    expect(runCheckedCommand).toHaveBeenCalledWith('adb', [
      '-s',
      'physical-device-1',
      'reverse',
      'tcp:8083',
      'tcp:8083',
    ]);

    physical.release();
    expect(runBestEffortCommand).toHaveBeenCalledWith('adb', [
      '-s',
      'physical-device-1',
      'reverse',
      '--remove',
      'tcp:8083',
    ]);
  });

  it('reuses an exact Android reverse route without taking cleanup ownership', () => {
    const runCheckedCommand = jest.fn();
    const runForOutputCommand = jest.fn((_command, args) =>
      args.at(-1) === '--list' ? 'transport tcp:8083 tcp:8083' : '0',
    );

    expect(
      configureDeviceMetro({
        deviceId: 'physical-device-1',
        metroPort: 8083,
        platform: 'android',
        runCheckedCommand,
        runForOutputCommand,
      }),
    ).toEqual({ metroUrl: 'http://127.0.0.1:8083' });
    expect(runCheckedCommand).not.toHaveBeenCalled();
  });

  it('refuses to overwrite a conflicting Android reverse route', () => {
    const runCheckedCommand = jest.fn();
    const runForOutputCommand = jest.fn((_command, args) =>
      args.at(-1) === '--list' ? 'transport tcp:8083 tcp:9090' : '0',
    );

    expect(() =>
      configureDeviceMetro({
        deviceId: 'physical-device-1',
        metroPort: 8083,
        platform: 'android',
        runCheckedCommand,
        runForOutputCommand,
      }),
    ).toThrow('already targets tcp:9090');
    expect(runCheckedCommand).not.toHaveBeenCalled();
  });

  it('keeps explicit and emulator Metro routes free of adb reverse', () => {
    const explicitRunChecked = jest.fn();
    const explicitRunForOutput = jest.fn();
    expect(
      configureDeviceMetro({
        deviceId: 'physical-device-1',
        metroPort: 8083,
        platform: 'android',
        requestedMetroUrl: 'http://192.168.1.5:9000',
        runCheckedCommand: explicitRunChecked,
        runForOutputCommand: explicitRunForOutput,
      }),
    ).toEqual({ metroUrl: 'http://192.168.1.5:9000' });
    expect(explicitRunForOutput).not.toHaveBeenCalled();
    expect(explicitRunChecked).not.toHaveBeenCalled();

    const emulatorRunChecked = jest.fn();
    const emulatorRunForOutput = jest.fn(() => '1');
    expect(
      configureDeviceMetro({
        deviceId: 'emulator-5554',
        metroPort: 8084,
        platform: 'android',
        runCheckedCommand: emulatorRunChecked,
        runForOutputCommand: emulatorRunForOutput,
      }),
    ).toEqual({ metroUrl: 'http://10.0.2.2:8084' });
    expect(emulatorRunChecked).not.toHaveBeenCalled();
  });

  it('waits for Android startup and checks that the process survives', async () => {
    const wait = jest.fn().mockResolvedValue(undefined);
    const androidOutput = jest
      .fn()
      .mockReturnValueOnce('')
      .mockReturnValueOnce('')
      .mockReturnValue('1234');
    await expect(
      waitForNativeAppStartup({
        deviceId: 'emulator-5554',
        launch: {},
        platform: 'android',
        runForOutputCommand: androidOutput,
        wait,
      }),
    ).resolves.toBeUndefined();
    expect(androidOutput).toHaveBeenCalledTimes(4);
    expect(androidOutput).toHaveBeenCalledWith('adb', [
      '-s',
      'emulator-5554',
      'shell',
      'pidof',
      'so.onekey.app.wallet',
    ]);
    expect(wait).toHaveBeenNthCalledWith(1, 500);
    expect(wait).toHaveBeenNthCalledWith(2, 500);
    expect(wait).toHaveBeenNthCalledWith(3, 1500);
  });

  it('prewarms the version-bound main and background runtime bundles', async () => {
    const fingerprint = 'a'.repeat(64);
    const sessionId = 'wk-111111111111-dev-222222222222-3333333333333333';
    const fetchImpl = jest.fn(async (input) => {
      const url = new URL(input);
      return new Response(url.searchParams.get('resolver.runtimeTarget'), {
        status: 200,
      });
    });

    await expect(
      prewarmNativeRuntimeBundles({
        fetchImpl,
        fingerprint,
        metroPort: 8081,
        platform: 'android',
        sessionId,
      }),
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const urls = fetchImpl.mock.calls.map(([input]) => new URL(input));
    expect(urls.map((url) => url.pathname)).toEqual([
      '/.expo/.virtual-metro-entry.bundle',
      '/background.bundle',
    ]);
    expect(
      urls.map((url) => url.searchParams.get('resolver.runtimeTarget')),
    ).toEqual(['main', 'background']);
    for (const url of urls) {
      expect(url.searchParams.get('resolver.devVendorFingerprint')).toBe(
        fingerprint,
      );
      expect(url.searchParams.get('resolver.devSessionId')).toBe(sessionId);
      expect(url.searchParams.get('modulesOnly')).toBe('true');
    }
  });

  it('matches the native runtime bundle URL contract', () => {
    const url = getNativeRuntimeBundleUrl({
      fingerprint: 'a'.repeat(64),
      metroPort: 8082,
      platform: 'ios',
      runtimeTarget: 'background',
      sessionId: 'wk-111111111111-dev-222222222222-3333333333333333',
    });

    expect(url.origin).toBe('http://127.0.0.1:8082');
    expect(url.pathname).toBe('/background.bundle');
    expect(url.searchParams.get('platform')).toBe('ios');
    expect(url.searchParams.get('resolver.devVendorNative')).toBe('true');
    expect(url.searchParams.get('unstable_transformProfile')).toBe(
      'hermes-stable',
    );
  });

  it('selects a Java 17 JDK for Android local shell builds', () => {
    const androidSdkRoot = path.join(temporaryDirectory, 'android-sdk');
    fs.mkdirSync(path.join(androidSdkRoot, 'platform-tools'), {
      recursive: true,
    });
    const spawnCommand = jest.fn((command) => {
      if (command === '/usr/libexec/java_home') {
        return { status: 0, stderr: '', stdout: '/jdk-17\n' };
      }
      if (command === '/jdk-24/bin/java') {
        return {
          status: 0,
          stderr: 'openjdk version "24.0.2"',
          stdout: '',
        };
      }
      if (command === '/jdk-17/bin/java') {
        return {
          status: 0,
          stderr: 'openjdk version "17.0.16"',
          stdout: '',
        };
      }
      if (command === 'which') {
        return { status: 1, stderr: '', stdout: '' };
      }
      return {
        error: { message: `Unexpected command: ${command}` },
        status: null,
        stderr: '',
        stdout: '',
      };
    });

    expect(
      getAndroidLocalBuildEnvironment({
        env: {
          ANDROID_HOME: androidSdkRoot,
          JAVA_HOME: '/jdk-24',
          PATH: '/usr/bin',
        },
        hostPlatform: 'darwin',
        spawnCommand,
      }),
    ).toMatchObject({
      ANDROID_HOME: androidSdkRoot,
      ANDROID_SDK_ROOT: androidSdkRoot,
      JAVA_HOME: '/jdk-17',
      PATH: `/jdk-17/bin${path.delimiter}/usr/bin`,
    });
  });

  it('checks that an iOS app survives its startup grace period', async () => {
    const wait = jest.fn().mockResolvedValue(undefined);
    const iosOutput = jest.fn().mockReturnValue('');
    await expect(
      waitForNativeAppStartup({
        deviceId: 'SIMULATOR-A',
        launch: { processId: 4321 },
        platform: 'ios',
        runForOutputCommand: iosOutput,
        wait,
      }),
    ).resolves.toBeUndefined();
    expect(iosOutput).toHaveBeenCalledWith('xcrun', [
      'simctl',
      'spawn',
      'SIMULATOR-A',
      '/bin/kill',
      '-0',
      '4321',
    ]);
    expect(wait).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledWith(1500);
  });

  it('fails when Android startup exhausts its process wait budget', async () => {
    const wait = jest.fn().mockResolvedValue(undefined);
    await expect(
      waitForNativeAppStartup({
        androidPollIntervalMs: 500,
        androidStartupTimeoutMs: 1000,
        deviceId: 'emulator-5554',
        launch: {},
        platform: 'android',
        runForOutputCommand: () => '',
        wait,
      }),
    ).rejects.toThrow('android app exited during startup');
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it('fails when the Android process exits during its startup grace period', async () => {
    const androidOutput = jest
      .fn()
      .mockReturnValueOnce('1234')
      .mockReturnValueOnce('');
    await expect(
      waitForNativeAppStartup({
        deviceId: 'emulator-5554',
        launch: {},
        platform: 'android',
        runForOutputCommand: androidOutput,
        wait: jest.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toThrow('android app exited during startup');
  });

  it('fails before reporting running when the launched app exits', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../native-dev-shell.js'),
      'utf8',
    );
    const launchSource = source.slice(
      source.indexOf('async function launchDevShell('),
      source.indexOf('\nasync function main()'),
    );
    expect(
      launchSource.indexOf('await waitForNativeAppStartup({'),
    ).toBeLessThan(launchSource.indexOf("report.status = 'running';"));
  });

  it('captures the iOS process ID returned by simctl launch', () => {
    const runForOutputCommand = jest
      .fn()
      .mockReturnValue('so.onekey.wallet: 4321');
    expect(
      launchNativeApp('ios', 'SIMULATOR-A', { runForOutputCommand }),
    ).toEqual({ processId: 4321 });
    expect(runForOutputCommand).toHaveBeenCalledWith('xcrun', [
      'simctl',
      'launch',
      '--terminate-running-process',
      'SIMULATOR-A',
      'so.onekey.wallet',
    ]);
  });

  it('routes Android recovery before constructing the React activity', () => {
    const androidRoot = path.join(__dirname, '../../android/app/src/main');
    const launcherActivity = fs.readFileSync(
      path.join(
        androidRoot,
        'java/so/onekey/app/wallet/MainLauncherActivity.java',
      ),
      'utf8',
    );
    const mainActivity = fs.readFileSync(
      path.join(androidRoot, 'java/so/onekey/app/wallet/MainActivity.java'),
      'utf8',
    );
    const mainApplication = fs.readFileSync(
      path.join(
        androidRoot,
        'java/so/onekey/app/wallet/BaseMainApplication.java',
      ),
      'utf8',
    );
    const manifest = fs.readFileSync(
      path.join(androidRoot, 'AndroidManifest.xml'),
      'utf8',
    );
    const nativeDevShell = fs.readFileSync(
      path.join(__dirname, '../native-dev-shell.js'),
      'utf8',
    );
    const androidReleaseDeploy = fs.readFileSync(
      path.join(
        __dirname,
        '../../../../development/scripts/android-release-build-deploy.sh',
      ),
      'utf8',
    );

    expect(launcherActivity).toContain(
      'class MainLauncherActivity extends Activity',
    );
    expect(launcherActivity).not.toContain('ReactActivity');
    expect(launcherActivity).toContain(
      'if (!MainActivity.hasCreatedInstance()) {',
    );
    expect(
      launcherActivity.indexOf('BootRecoveryStore.recordBootAttempt('),
    ).toBeLessThan(
      launcherActivity.indexOf(
        'startActivity(new Intent(this, RecoveryActivity.class));',
      ),
    );
    expect(
      launcherActivity.indexOf(
        'startActivity(new Intent(this, RecoveryActivity.class));',
      ),
    ).toBeLessThan(launcherActivity.indexOf('MainActivity.class'));
    expect(launcherActivity).toContain('new Intent(getIntent())');
    expect(mainActivity).not.toContain('BootRecoveryStore.recordBootAttempt(');
    expect(mainActivity).toContain('class RecoveryReactActivityDelegate');
    expect(mainActivity).toContain(
      'return new RecoveryReactActivityDelegate(this);',
    );
    expect(
      mainActivity.indexOf('if (MainApplication.shouldShowRecovery) {'),
    ).toBeLessThan(
      mainActivity.indexOf(
        'startActivity(new Intent(this, RecoveryActivity.class));',
      ),
    );
    expect(
      mainActivity.indexOf(
        'startActivity(new Intent(this, RecoveryActivity.class));',
      ),
    ).toBeLessThan(mainActivity.indexOf('hasCreatedInstance = true;'));
    expect(mainActivity).toContain('hasCreatedInstance = true;');
    expect(mainActivity).toContain('hasCreatedInstance = false;');
    expect(mainApplication.indexOf('if (shouldShowRecovery) {')).toBeLessThan(
      mainApplication.indexOf('SoLoader.init('),
    );

    const launcherManifestStart = manifest.indexOf(
      '<activity android:name=".MainLauncherActivity"',
    );
    const launcherManifestEnd = manifest.indexOf(
      '</activity>',
      launcherManifestStart,
    );
    const launcherManifest = manifest.slice(
      launcherManifestStart,
      launcherManifestEnd,
    );
    expect(launcherManifest).toContain('android:exported="true"');
    expect(launcherManifest).toContain('android.intent.action.MAIN');
    expect(launcherManifest).toContain('android.intent.action.VIEW');
    expect(manifest).toContain(
      '<activity android:name=".MainActivity" android:label="@string/app_name"',
    );
    expect(manifest).toContain(
      'android:exported="false" android:screenOrientation="portrait" android:supportsPictureInPicture="true" />',
    );
    expect(nativeDevShell).toContain(
      'so.onekey.app.wallet/.MainLauncherActivity',
    );
    expect(androidReleaseDeploy).toContain(
      '$PACKAGE_NAME/.MainLauncherActivity',
    );
    expect(androidReleaseDeploy).not.toContain('$PACKAGE_NAME/.MainActivity');
  });

  it('keeps Android reverse ownership inside the device lock lifetime', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../native-dev-shell.js'),
      'utf8',
    );
    const launchSource = source.slice(
      source.indexOf('async function launchDevShell('),
    );
    const lockIndex = launchSource.indexOf(
      'const deviceLock = acquireNamedLock(',
    );
    const configureIndex = launchSource.indexOf(
      'const deviceMetro = configureDeviceMetro(',
    );
    const releaseRouteIndex = launchSource.indexOf(
      'releaseDeviceMetroRoute?.();',
    );
    const releaseLockIndex = launchSource.indexOf('deviceLock.release();');

    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(configureIndex).toBeGreaterThan(lockIndex);
    expect(releaseRouteIndex).toBeGreaterThan(configureIndex);
    expect(releaseLockIndex).toBeGreaterThan(releaseRouteIndex);
  });

  it('keeps the complete Android run-as script in one quoted adb argument', () => {
    const deviceId = 'emulator-5554';
    const sessionId = 'wk-111111111111-dev-222222222222-3333333333333333';
    const args = getAndroidPrivateSessionInstallArgs({ deviceId, sessionId });

    expect(args.slice(0, -1)).toEqual([
      '-s',
      deviceId,
      'shell',
      'run-as',
      'so.onekey.app.wallet',
      'sh',
      '-c',
    ]);
    expect(args.at(-1)).toMatch(/^'umask 077 .* && .*'$/u);
    expect(args.at(-1)).toContain(
      `mv files/onekey-dev-sessions/current.json.tmp-${sessionId} files/onekey-dev-sessions/current.json`,
    );

    const probeValue = "first'part && second part";
    const probe = spawnSync(
      '/bin/sh',
      [
        '-c',
        `set -- ${quoteAdbShellArgument(probeValue)}; printf '%s\\n%s' "$#" "$1"`,
      ],
      { encoding: 'utf8' },
    );
    expect(probe).toMatchObject({ status: 0, stdout: `1\n${probeValue}` });
  });

  it('atomically renews the current Android private session through stdin', async () => {
    const deviceId = 'emulator-5554';
    const session = createDevSession({
      deviceId,
      platform: 'android',
      sessionId: 'wk-111111111111-dev-222222222222-3333333333333333',
    });
    const runCheckedCommand = jest.fn();
    const runForOutputCommand = jest
      .fn()
      .mockReturnValue(JSON.stringify(createCurrentSession(session)));
    const nowEpochMs = 123_000;

    const renewedSession = await renewPrivateSession({
      deviceId,
      nowEpochMs,
      platform: 'android',
      runCheckedCommand,
      runForOutputCommand,
      session,
    });

    expect(runForOutputCommand).toHaveBeenCalledWith('adb', [
      '-s',
      deviceId,
      'exec-out',
      'run-as',
      'so.onekey.app.wallet',
      'cat',
      'files/onekey-dev-sessions/current.json',
    ]);
    const expectedArgs = getAndroidPrivateSessionRenewalArgs({
      deviceId,
      sessionId: session.sessionId,
    });
    expect(runCheckedCommand).toHaveBeenCalledWith(
      'adb',
      expectedArgs,
      expect.objectContaining({
        input: `${JSON.stringify(renewedSession, null, 2)}\n`,
        stdio: ['pipe', 'inherit', 'inherit'],
      }),
    );
    expect(expectedArgs.slice(0, -1)).toEqual([
      '-s',
      deviceId,
      'shell',
      'run-as',
      'so.onekey.app.wallet',
      'sh',
      '-c',
    ]);
    expect(expectedArgs.at(-1)).toMatch(/^'umask 077 .* && .*'$/u);
    expect(expectedArgs.at(-1)).toContain(
      `cat > files/onekey-dev-sessions/${session.sessionId}/session.json.tmp-${session.sessionId} && mv files/onekey-dev-sessions/${session.sessionId}/session.json.tmp-${session.sessionId} files/onekey-dev-sessions/${session.sessionId}/session.json`,
    );
    expect(expectedArgs.join(' ')).not.toContain(renewedSession.expiresAt);
    expect(renewedSession.expiresAtEpochMs).toBe(
      nowEpochMs + 12 * 60 * 60 * 1000,
    );
    expect(renewedSession).toEqual(
      createRenewedDevSession(session, { nowEpochMs }),
    );
    expect(session.expiresAtEpochMs).toBe(12 * 60 * 60 * 1000);

    runCheckedCommand.mockClear();
    runForOutputCommand.mockReturnValue(
      JSON.stringify({
        ...createCurrentSession(session),
        sessionId: 'wk-111111111111-dev-222222222222-4444444444444444',
      }),
    );
    await expect(
      renewPrivateSession({
        deviceId,
        nowEpochMs,
        platform: 'android',
        runCheckedCommand,
        runForOutputCommand,
        session,
      }),
    ).rejects.toThrow('is no longer current');
    expect(runCheckedCommand).not.toHaveBeenCalled();
  });

  it('atomically renews isolated iOS Simulator session containers', async () => {
    const sessions = [
      createDevSession({
        deviceId: 'SIMULATOR-A',
        platform: 'ios',
        sessionId: 'wk-111111111111-dev-aaaaaaaaaaaa-1111111111111111',
      }),
      createDevSession({
        deviceId: 'SIMULATOR-B',
        platform: 'ios',
        sessionId: 'wk-111111111111-dev-bbbbbbbbbbbb-2222222222222222',
      }),
    ];
    const containers = new Map(
      sessions.map((session) => [
        session.deviceId,
        path.join(temporaryDirectory, session.deviceId),
      ]),
    );
    for (const session of sessions) {
      const appRoot = path.join(
        containers.get(session.deviceId),
        'Library/Application Support/onekey-dev-sessions',
      );
      const sessionDirectory = path.join(appRoot, session.sessionId);
      fs.mkdirSync(sessionDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(appRoot, 'current.json'),
        JSON.stringify(createCurrentSession(session)),
      );
      fs.writeFileSync(
        path.join(sessionDirectory, 'session.json'),
        JSON.stringify(session),
      );
    }
    const renameCalls = [];
    const fileSystem = {
      promises: {
        lstat: (...args) => fs.promises.lstat(...args),
        readFile: (...args) => fs.promises.readFile(...args),
        rename: (...args) => {
          renameCalls.push(args);
          return fs.promises.rename(...args);
        },
        rm: (...args) => fs.promises.rm(...args),
        writeFile: (...args) => fs.promises.writeFile(...args),
      },
    };
    const runForOutputCommand = jest.fn((_command, args) => {
      return containers.get(args[2]);
    });

    for (const [index, session] of sessions.entries()) {
      await renewPrivateSession({
        deviceId: session.deviceId,
        fileSystem,
        nowEpochMs: 1_000_000 + index,
        platform: 'ios',
        runForOutputCommand,
        session,
      });
    }

    expect(runForOutputCommand.mock.calls).toEqual(
      sessions.map((session) => [
        'xcrun',
        [
          'simctl',
          'get_app_container',
          session.deviceId,
          'so.onekey.wallet',
          'data',
        ],
      ]),
    );
    expect(renameCalls).toHaveLength(2);
    for (const [index, session] of sessions.entries()) {
      const sessionDirectory = path.join(
        containers.get(session.deviceId),
        'Library/Application Support/onekey-dev-sessions',
        session.sessionId,
      );
      const sessionPath = path.join(sessionDirectory, 'session.json');
      expect(renameCalls[index]).toEqual([
        path.join(sessionDirectory, `session.json.tmp-${session.sessionId}`),
        sessionPath,
      ]);
      expect(JSON.parse(fs.readFileSync(sessionPath, 'utf8'))).toMatchObject({
        deviceId: session.deviceId,
        expiresAtEpochMs: 1_000_000 + index + 12 * 60 * 60 * 1000,
        sessionId: session.sessionId,
      });
      expect(
        fs.existsSync(
          path.join(sessionDirectory, `session.json.tmp-${session.sessionId}`),
        ),
      ).toBe(false);
    }
  });

  it('awaits an in-flight renewal when Metro completes concurrently', async () => {
    let finishMetro;
    const metroCompletion = new Promise((resolve) => {
      finishMetro = resolve;
    });
    let finishRenewal;
    let markRenewalStarted;
    const renewalStarted = new Promise((resolve) => {
      markRenewalStarted = resolve;
    });
    const renewSession = jest.fn(
      () =>
        new Promise((resolve) => {
          finishRenewal = resolve;
          markRenewalStarted();
        }),
    );
    const waiting = waitForMetroCompletionWithSessionRenewal({
      initialExpiresAtEpochMs: 10_000,
      intervalMs: 0,
      metroCompletion,
      nowFn: () => 1000,
      renewSession,
    });
    await renewalStarted;
    finishMetro({ code: 0, signal: null });
    let settled = false;
    void waiting.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    finishRenewal({ expiresAtEpochMs: 20_000 });

    await expect(waiting).resolves.toEqual({ code: 0, signal: null });
    expect(renewSession).toHaveBeenCalledTimes(1);
  });

  it('retries transient renewal failures against the last successful expiry', async () => {
    let finishMetro;
    const metroCompletion = new Promise((resolve) => {
      finishMetro = resolve;
    });
    let renewalAttempts = 0;
    const renewalFailures = [];

    const result = await waitForMetroCompletionWithSessionRenewal({
      fatalExpiryWindowMs: 1500,
      initialExpiresAtEpochMs: 2000,
      intervalMs: 0,
      metroCompletion,
      nowFn: () => 1000,
      onRenewalFailure: (details) => {
        renewalFailures.push(details);
        if (details.consecutiveFailures === 2) {
          finishMetro({ code: 0, signal: null });
        }
      },
      renewSession: () => {
        renewalAttempts += 1;
        if (renewalAttempts === 2) {
          return Promise.resolve({ expiresAtEpochMs: 100_000 });
        }
        return fs.promises.readFile(
          path.join(temporaryDirectory, 'missing-session.json'),
        );
      },
      retryIntervalMs: 0,
    });

    expect(result).toEqual({ code: 0, signal: null });
    expect(renewalAttempts).toBe(4);
    expect(
      renewalFailures.map(
        ({ consecutiveFailures, expiresAtEpochMs, shouldPrintNotice }) => ({
          consecutiveFailures,
          expiresAtEpochMs,
          shouldPrintNotice,
        }),
      ),
    ).toEqual([
      {
        consecutiveFailures: 1,
        expiresAtEpochMs: 2000,
        shouldPrintNotice: true,
      },
      {
        consecutiveFailures: 1,
        expiresAtEpochMs: 100_000,
        shouldPrintNotice: true,
      },
      {
        consecutiveFailures: 2,
        expiresAtEpochMs: 100_000,
        shouldPrintNotice: false,
      },
    ]);
  });

  it('fails only after consecutive renewal errors approach expiry', async () => {
    let renewalAttempts = 0;
    const onRenewalFailure = jest.fn();

    await expect(
      waitForMetroCompletionWithSessionRenewal({
        fatalExpiryWindowMs: 1500,
        initialExpiresAtEpochMs: 2000,
        intervalMs: 0,
        metroCompletion: new Promise(() => {}),
        nowFn: () => 1000,
        onRenewalFailure,
        renewSession: () => {
          renewalAttempts += 1;
          return fs.promises.readFile(
            path.join(temporaryDirectory, 'missing-session.json'),
          );
        },
        retryIntervalMs: 0,
      }),
    ).rejects.toThrow('failed 2 consecutive times');
    expect(renewalAttempts).toBe(2);
    expect(
      onRenewalFailure.mock.calls.map(([details]) => ({
        consecutiveFailures: details.consecutiveFailures,
        shouldPrintNotice: details.shouldPrintNotice,
      })),
    ).toEqual([
      { consecutiveFailures: 1, shouldPrintNotice: true },
      { consecutiveFailures: 2, shouldPrintNotice: false },
    ]);
  });

  it('keeps repeated session renewal notices bounded', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const report = {
      deviceId: 'SIMULATOR-A',
      sessionId: 'session-a',
      userNoticeRequired: false,
      userNotices: [],
      worktreeId: 'worktree-a',
    };
    let renewalError;
    try {
      await fs.promises.readFile(
        path.join(temporaryDirectory, 'missing-session.json'),
      );
    } catch (error) {
      renewalError = error;
    }
    try {
      for (let index = 1; index <= 20; index += 1) {
        addSessionRenewalNotice(report, {
          consecutiveFailures: index,
          error: renewalError,
          expiresAtEpochMs: 100_000,
          remainingMs: 99_000 - index,
          retryIntervalMs: 30_000,
          shouldPrintNotice: index === 1,
        });
      }

      expect(report.userNoticeRequired).toBe(true);
      expect(
        report.userNotices.filter(
          (notice) => notice.resource === 'session-renewal',
        ),
      ).toHaveLength(1);
      expect(report.userNotices[0].notice).toContain('consecutiveFailures=20');
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[ONEKEY_USER_NOTICE]'),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('retries lock acquisition when the stale lock vanishes before stat', () => {
    const lockRoot = path.join(temporaryDirectory, 'stat-race-locks');
    const kind = 'test-stat-race';
    acquireNamedLock({
      key: 'shared',
      kind,
      lockRoot,
      owner: { pid: 101, sessionId: 'stale-owner' },
    });
    const lockDirectory = path.join(
      lockRoot,
      fs.readdirSync(lockRoot).find((name) => name.startsWith(`${kind}-`)),
    );
    let raced = false;
    const racingFileSystem = {
      ...fs,
      statSync(targetPath) {
        if (!raced && targetPath === lockDirectory) {
          raced = true;
          fs.rmSync(lockDirectory, { force: true, recursive: true });
          throw Object.assign(new Error('lock moved'), { code: 'ENOENT' });
        }
        return fs.statSync(targetPath);
      },
    };

    const acquired = acquireNamedLock({
      fileSystem: racingFileSystem,
      key: 'shared',
      kind,
      lockRoot,
      owner: { pid: process.pid, sessionId: 'replacement-owner' },
      processIsAlive: () => false,
    });
    expect(raced).toBe(true);
    expect(
      JSON.parse(fs.readFileSync(path.join(lockDirectory, 'owner.json')))
        .sessionId,
    ).toBe('replacement-owner');
    acquired.release();
  });

  it('reclaims a stale named lock after its PID is reused', () => {
    const lockRoot = path.join(temporaryDirectory, 'pid-reuse-locks');
    const kind = 'test-pid-reuse';
    const oldProcessStartedAtMs = 1000;
    const currentProcessStartedAtMs = 5000;
    acquireNamedLock({
      getProcessStartedAt: () => oldProcessStartedAtMs,
      key: 'shared',
      kind,
      lockRoot,
      owner: { pid: process.pid, sessionId: 'stale-owner' },
    });

    const acquired = acquireNamedLock({
      getProcessStartedAt: () => currentProcessStartedAtMs,
      key: 'shared',
      kind,
      lockRoot,
      owner: { pid: process.pid, sessionId: 'replacement-owner' },
      processIsAlive: () => true,
    });
    const lockDirectory = path.join(
      lockRoot,
      fs.readdirSync(lockRoot).find((name) => name.startsWith(`${kind}-`)),
    );
    expect(
      JSON.parse(fs.readFileSync(path.join(lockDirectory, 'owner.json'))),
    ).toMatchObject({
      pid: process.pid,
      processStartedAtMs: currentProcessStartedAtMs,
      sessionId: 'replacement-owner',
    });
    acquired.release();
  });

  it('rejects a mixed-generation snapshot when root changes after owner read', () => {
    const lockRoot = path.join(temporaryDirectory, 'snapshot-race-locks');
    const kind = 'test-snapshot-race';
    acquireNamedLock({
      key: 'shared',
      kind,
      lockRoot,
      owner: { pid: 101, sessionId: 'old-owner' },
    });
    const lockDirectory = path.join(
      lockRoot,
      fs.readdirSync(lockRoot).find((name) => name.startsWith(`${kind}-`)),
    );
    const ownerPath = path.join(lockDirectory, 'owner.json');
    const newOwner = { pid: 202, sessionId: 'new-owner' };
    let replaced = false;
    const racingFileSystem = {
      ...fs,
      statSync(targetPath) {
        const stats = fs.statSync(targetPath);
        if (targetPath === lockDirectory) {
          Object.defineProperties(stats, {
            dev: { value: 7 },
            ino: { value: 11 },
          });
        }
        return stats;
      },
      readFileSync(targetPath, ...args) {
        const value = fs.readFileSync(targetPath, ...args);
        if (!replaced && targetPath === ownerPath) {
          replaced = true;
          fs.rmSync(lockDirectory, { force: true, recursive: true });
          fs.mkdirSync(lockDirectory);
          fs.writeFileSync(ownerPath, `${JSON.stringify(newOwner)}\n`);
        }
        return value;
      },
    };

    expect(
      acquireNamedLock({
        fileSystem: racingFileSystem,
        key: 'shared',
        kind,
        lockRoot,
        owner: { pid: 303, sessionId: 'unexpected-owner' },
        processIsAlive: (pid) => pid === newOwner.pid,
        returnNullWhenBusy: true,
      }),
    ).toBeNull();
    expect(replaced).toBe(true);
    expect(JSON.parse(fs.readFileSync(ownerPath))).toEqual(newOwner);
    expect(fs.existsSync(path.join(lockDirectory, '.reclaim'))).toBe(false);
  });

  it('cleans up its own marker after the main owner generation changes', () => {
    const lockRoot = path.join(temporaryDirectory, 'marker-cleanup-locks');
    const kind = 'test-marker-cleanup';
    acquireNamedLock({
      key: 'shared',
      kind,
      lockRoot,
      owner: { pid: 101, sessionId: 'stale-owner' },
    });
    const lockDirectory = path.join(
      lockRoot,
      fs.readdirSync(lockRoot).find((name) => name.startsWith(`${kind}-`)),
    );
    const ownerPath = path.join(lockDirectory, 'owner.json');
    const markerOwnerPath = path.join(lockDirectory, '.reclaim', 'owner.json');
    const newOwner = { pid: 202, sessionId: 'new-owner' };
    let replaced = false;
    const racingFileSystem = {
      ...fs,
      writeFileSync(targetPath, ...args) {
        const result = fs.writeFileSync(targetPath, ...args);
        if (!replaced && targetPath === markerOwnerPath) {
          replaced = true;
          fs.writeFileSync(ownerPath, `${JSON.stringify(newOwner)}\n`);
        }
        return result;
      },
    };

    expect(
      acquireNamedLock({
        fileSystem: racingFileSystem,
        key: 'shared',
        kind,
        lockRoot,
        owner: { pid: 303, sessionId: 'unexpected-owner' },
        processIsAlive: (pid) => pid === newOwner.pid,
        returnNullWhenBusy: true,
      }),
    ).toBeNull();
    expect(replaced).toBe(true);
    expect(JSON.parse(fs.readFileSync(ownerPath))).toEqual(newOwner);
    expect(fs.existsSync(path.join(lockDirectory, '.reclaim'))).toBe(false);
  });

  it('does not remove a competing owner after losing a stale rename race', () => {
    const lockRoot = path.join(temporaryDirectory, 'rename-race-locks');
    const kind = 'test-rename-race';
    acquireNamedLock({
      key: 'shared',
      kind,
      lockRoot,
      owner: { pid: 101, sessionId: 'stale-owner' },
    });
    const lockDirectory = path.join(
      lockRoot,
      fs.readdirSync(lockRoot).find((name) => name.startsWith(`${kind}-`)),
    );
    const competingOwner = { pid: 202, sessionId: 'competing-owner' };
    let raced = false;
    const racingFileSystem = {
      ...fs,
      renameSync(sourcePath, stalePath) {
        if (!raced && sourcePath === lockDirectory) {
          raced = true;
          fs.renameSync(sourcePath, stalePath);
          fs.rmSync(stalePath, { force: true, recursive: true });
          fs.mkdirSync(sourcePath);
          fs.writeFileSync(
            path.join(sourcePath, 'owner.json'),
            `${JSON.stringify(competingOwner)}\n`,
          );
          throw Object.assign(new Error('stale lock already moved'), {
            code: 'ENOENT',
          });
        }
        return fs.renameSync(sourcePath, stalePath);
      },
    };

    expect(
      acquireNamedLock({
        fileSystem: racingFileSystem,
        key: 'shared',
        kind,
        lockRoot,
        owner: { pid: process.pid, sessionId: 'unexpected-owner' },
        processIsAlive: (pid) => pid === competingOwner.pid,
        returnNullWhenBusy: true,
      }),
    ).toBeNull();
    expect(raced).toBe(true);
    expect(
      JSON.parse(fs.readFileSync(path.join(lockDirectory, 'owner.json'))),
    ).toEqual(competingOwner);
  });

  it('allows only one cleaner to reclaim a stale lock generation', () => {
    const lockRoot = path.join(temporaryDirectory, 'reclaim-marker-locks');
    const kind = 'test-reclaim-marker';
    acquireNamedLock({
      key: 'shared',
      kind,
      lockRoot,
      owner: { pid: 101, sessionId: 'stale-owner' },
    });
    const lockDirectory = path.join(
      lockRoot,
      fs.readdirSync(lockRoot).find((name) => name.startsWith(`${kind}-`)),
    );
    let secondCleanerResult;
    const firstCleanerFileSystem = {
      ...fs,
      renameSync(sourcePath, stalePath) {
        secondCleanerResult = acquireNamedLock({
          key: 'shared',
          kind,
          lockRoot,
          owner: { pid: 202, sessionId: 'second-cleaner' },
          processIsAlive: (pid) => pid === process.pid,
          returnNullWhenBusy: true,
        });
        return fs.renameSync(sourcePath, stalePath);
      },
    };

    const firstOwner = { pid: process.pid, sessionId: 'first-cleaner' };
    const firstCleanerResult = acquireNamedLock({
      fileSystem: firstCleanerFileSystem,
      key: 'shared',
      kind,
      lockRoot,
      owner: firstOwner,
      processIsAlive: () => false,
    });

    expect(secondCleanerResult).toBeNull();
    expect(
      acquireNamedLock({
        key: 'shared',
        kind,
        lockRoot,
        owner: { pid: 303, sessionId: 'late-second-cleaner' },
        processIsAlive: (pid) => pid === firstOwner.pid,
        returnNullWhenBusy: true,
      }),
    ).toBeNull();
    expect(
      JSON.parse(fs.readFileSync(path.join(lockDirectory, 'owner.json'))),
    ).toMatchObject(firstOwner);
    firstCleanerResult.release();
  });

  it('recovers a dead reclaimer marker and acquires the stale lock', () => {
    const lockRoot = path.join(temporaryDirectory, 'dead-reclaimer-locks');
    const kind = 'test-dead-reclaimer';
    acquireNamedLock({
      key: 'shared',
      kind,
      lockRoot,
      owner: { pid: 101, sessionId: 'stale-owner' },
    });
    const lockDirectory = path.join(
      lockRoot,
      fs.readdirSync(lockRoot).find((name) => name.startsWith(`${kind}-`)),
    );
    writeReclaimMarker({
      lockDirectory,
      mainOwnerToken: 'stale-owner',
      pid: 202,
      token: 'crashed-reclaimer-token',
    });

    const acquired = acquireNamedLock({
      key: 'shared',
      kind,
      lockRoot,
      owner: { pid: process.pid, sessionId: 'recovered-owner' },
      processIsAlive: () => false,
    });

    expect(
      JSON.parse(fs.readFileSync(path.join(lockDirectory, 'owner.json')))
        .sessionId,
    ).toBe('recovered-owner');
    acquired.release();
  });

  it('does not steal a stale lock from a live reclaimer marker', () => {
    const lockRoot = path.join(temporaryDirectory, 'live-reclaimer-locks');
    const kind = 'test-live-reclaimer';
    acquireNamedLock({
      key: 'shared',
      kind,
      lockRoot,
      owner: { pid: 101, sessionId: 'stale-owner' },
    });
    const lockDirectory = path.join(
      lockRoot,
      fs.readdirSync(lockRoot).find((name) => name.startsWith(`${kind}-`)),
    );
    const markerDirectory = writeReclaimMarker({
      lockDirectory,
      mainOwnerToken: 'stale-owner',
      pid: 202,
      token: 'live-reclaimer-token',
    });

    expect(
      acquireNamedLock({
        key: 'shared',
        kind,
        lockRoot,
        owner: { pid: 303, sessionId: 'unexpected-owner' },
        processIsAlive: (pid) => pid === 202,
        returnNullWhenBusy: true,
      }),
    ).toBeNull();
    expect(
      JSON.parse(fs.readFileSync(path.join(markerDirectory, 'owner.json')))
        .token,
    ).toBe('live-reclaimer-token');
    expect(
      JSON.parse(fs.readFileSync(path.join(lockDirectory, 'owner.json')))
        .sessionId,
    ).toBe('stale-owner');
  });

  it('separates and locks the local Metro port from the device-visible URL', async () => {
    expect(parseMetroPort('8188')).toBe(8188);
    expect(() => parseMetroPort('443.5')).toThrow('Invalid --metro-port');

    const first = await acquireMetroPort({
      deviceId: 'device-a',
      sessionId: 'session-a',
    });
    try {
      await expect(
        acquireMetroPort({
          deviceId: 'device-b',
          requestedPort: String(first.port),
          sessionId: 'session-b',
        }),
      ).rejects.toThrow('already locked');
    } finally {
      first.lock.release();
    }
  });

  it('serializes shared worktree preparation across device sessions', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const firstReport = {
      deviceId: 'device-a',
      sessionId: 'session-preparation-a',
      userNoticeRequired: false,
      userNotices: [],
      worktreeId: 'worktree-test',
    };
    const secondReport = {
      deviceId: 'device-b',
      sessionId: 'session-preparation-b',
      userNoticeRequired: false,
      userNotices: [],
      worktreeId: 'worktree-test',
    };
    const first = await acquireWorktreePreparationLock({
      report: firstReport,
      waitIntervalMs: 5,
    });
    let second;
    try {
      const waiting = acquireWorktreePreparationLock({
        report: secondReport,
        waitIntervalMs: 5,
      });
      setTimeout(() => first.release(), 20);
      second = await waiting;
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('action=wait-worktree-preparation'),
      );
    } finally {
      first.release();
      second?.release();
      consoleError.mockRestore();
    }
  });

  it('keeps host session staging directories bounded', async () => {
    const sessionIds = [
      'wk-111111111111-dev-222222222222-0000000000000001',
      'wk-111111111111-dev-222222222222-0000000000000002',
      'wk-111111111111-dev-222222222222-0000000000000003',
      'wk-111111111111-dev-222222222222-0000000000000004',
    ];
    for (const [index, sessionId] of sessionIds.entries()) {
      const directory = path.join(temporaryDirectory, sessionId);
      fs.mkdirSync(directory);
      const modifiedAt = new Date(1000 + index * 1000);
      fs.utimesSync(directory, modifiedAt, modifiedAt);
    }

    await pruneSessionDirectories(temporaryDirectory, {
      maxSessions: 2,
      preserveSessionId: sessionIds[0],
    });

    expect(fs.readdirSync(temporaryDirectory).toSorted()).toEqual(
      [sessionIds[0], sessionIds[3]].toSorted(),
    );
  });

  it('marks successful local fallback as a required user notice', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    try {
      const report = createRunReport({
        metroUrl: 'http://127.0.0.1:8081',
        platform: 'ios',
        shell: 'auto',
        vendor: 'auto',
      });
      addFallbackNotice(report, {
        reason: 'remote artifact missing',
        resource: 'shell',
      });

      expect(report.userNoticeRequired).toBe(true);
      expect(report.userNotices).toEqual([
        expect.objectContaining({
          reason: 'remote artifact missing',
          resource: 'shell',
        }),
      ]);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[ONEKEY_USER_NOTICE]'),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('keeps clean summaries informational and failures actionable', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    try {
      const report = createRunReport({
        deviceId: 'device-a',
        metroPort: 8081,
        metroUrl: 'http://127.0.0.1:8081',
        platform: 'ios',
        sessionId: 'wk-111111111111-dev-222222222222-3333333333333333',
        shell: 'auto',
        vendor: 'auto',
        worktreeId: '111111111111',
      });
      report.status = 'finished';
      printRunSummary(report);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[ONEKEY_RUN_SUMMARY]'),
      );
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining('[ONEKEY_USER_NOTICE]'),
      );

      addFailureNotice(report, 'Metro stopped');
      expect(report.userNoticeRequired).toBe(true);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining(
          '[ONEKEY_USER_NOTICE] worktree=111111111111 device=device-a session=wk-111111111111-dev-222222222222-3333333333333333 action=run-failed',
        ),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it.each([
    'ftp://metro.example.com',
    'http://user:password@metro.example.com',
    'http://metro.example.com/path',
    'http://metro.example.com?query=true',
  ])('rejects a Metro URL that is not an origin: %s', (url) => {
    expect(() => parseMetroBaseUrl(url)).toThrow(
      '--metro-url must be an HTTP(S) origin',
    );
  });

  it('binds an explicit device route to launcher-owned Metro', () => {
    const nativeDevShell = fs.readFileSync(
      path.join(__dirname, '../native-dev-shell.js'),
      'utf8',
    );
    const launchSource = nativeDevShell.slice(
      nativeDevShell.indexOf('async function launchDevShell('),
      nativeDevShell.indexOf('\nasync function main()'),
    );

    expect(launchSource.indexOf('parseMetroBaseUrl(metroUrl)')).toBeLessThan(
      launchSource.indexOf('const deviceLock = acquireNamedLock({'),
    );
    expect(launchSource.indexOf('const metroAllocation =')).toBeGreaterThan(
      launchSource.indexOf('try {'),
    );
    expect(launchSource).toContain(
      'requestedMetroUrl: requestedDeviceMetroUrl',
    );
    expect(launchSource).toContain('ONEKEY_DEV_SESSION_ID: sessionId');
  });

  it('binds each shell platform to its native contract', () => {
    const android = getContractManifest('android');
    const ios = getContractManifest('ios');

    expect(android.nativeContractKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(ios.nativeContractKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(ios.nativeContractKey).not.toBe(android.nativeContractKey);
    expect(android).toMatchObject({ platform: 'android', schemaVersion: 1 });
    expect(ios).toMatchObject({ platform: 'ios', schemaVersion: 1 });
  });

  it('holds a restored shell cache lease through device installation', () => {
    const nativeDevShell = fs.readFileSync(
      path.join(__dirname, '../native-dev-shell.js'),
      'utf8',
    );
    const installSource = nativeDevShell.slice(
      nativeDevShell.indexOf('async function resolveAndInstallShell('),
      nativeDevShell.indexOf('\nasync function prepareVendor('),
    );

    const cleanupSource = installSource.slice(
      installSource.indexOf('await runWithCacheLeaseCleanup({'),
    );
    expect(cleanupSource).toContain('operation: async () => {');
    expect(cleanupSource.indexOf('await installMobileDevShell({')).toBeLessThan(
      cleanupSource.indexOf('releaseCacheLease,'),
    );
  });

  it('keeps dev session bootstrap private and session-scoped on both platforms', () => {
    const nativeDevShell = fs.readFileSync(
      path.join(__dirname, '../native-dev-shell.js'),
      'utf8',
    );
    const androidApplication = fs.readFileSync(
      path.join(
        __dirname,
        '../../android/app/src/debug/java/so/onekey/app/wallet/MainApplication.java',
      ),
      'utf8',
    );
    const androidActivity = fs.readFileSync(
      path.join(
        __dirname,
        '../../android/app/src/main/java/so/onekey/app/wallet/MainActivity.java',
      ),
      'utf8',
    );
    const iosDelegate = fs.readFileSync(
      path.join(__dirname, '../../ios/AppDelegate.swift'),
      'utf8',
    );
    const metroConfig = fs.readFileSync(
      path.join(__dirname, '../../metro.config.js'),
      'utf8',
    );
    const webViewWebEmbed = fs.readFileSync(
      path.join(
        __dirname,
        '../../../../packages/kit/src/components/WebViewWebEmbed/index.tsx',
      ),
      'utf8',
    );

    expect(androidActivity).not.toContain('ONEKEY_DEV_SESSION_URL');
    expect(androidApplication).toContain(
      'new File(sessionRoot, "current.json")',
    );
    expect(androidApplication).toContain(
      '!deviceId.equals(session.optString("deviceId"))',
    );
    expect(iosDelegate).not.toContain('ONEKEY_DEV_SESSION_URL');
    expect(iosDelegate).toContain(
      'session["worktreeId"] as? String == worktreeId',
    );
    expect(iosDelegate).toContain('let host = components.host');
    expect(iosDelegate).toContain('!host.isEmpty');
    expect(iosDelegate).toContain('components.path = ""');
    expect(metroConfig).not.toContain('/onekey-dev/');
    expect(metroConfig).toContain('/onekey-dev-session/web-embed/');
    expect(metroConfig).toContain("res.setHeader('Cache-Control', 'no-store')");
    expect(webViewWebEmbed).toContain(
      "searchParams.get('resolver.devSessionId')",
    );
    expect(webViewWebEmbed).toContain(
      '/onekey-dev-session/web-embed/index.html',
    );
    expect(nativeDevShell).toContain(
      "['workspace', '@onekeyhq/web-embed', 'prebundle:build']",
    );
    expect(nativeDevShell).not.toContain("['app:web-embed:build']");
    expect(nativeDevShell.indexOf('await stagePrivateSession({')).toBeLessThan(
      nativeDevShell.indexOf('preparationLock.release();'),
    );
    expect(nativeDevShell.indexOf('await waitForMetro(')).toBeLessThan(
      nativeDevShell.indexOf('preparationLock.release();'),
    );
    expect(nativeDevShell.indexOf('preparationLock.release();')).toBeLessThan(
      nativeDevShell.indexOf('await prewarmNativeRuntimeBundles({'),
    );
    const launchSource = nativeDevShell.slice(
      nativeDevShell.indexOf('async function launchDevShell('),
      nativeDevShell.indexOf('\nasync function main()'),
    );
    expect(
      launchSource.indexOf('await prepareWebEmbedForDevSession(report)'),
    ).toBeLessThan(launchSource.indexOf('await resolveAndInstallShell({'));
    expect(
      launchSource.indexOf('await prewarmNativeRuntimeBundles({'),
    ).toBeLessThan(launchSource.indexOf('launchNativeApp('));
    expect(launchSource).toContain(
      'await waitForMetroCompletionWithSessionRenewal({',
    );
    expect(launchSource).toContain('addFailureNotice(report, report.failure);');
  });

  it('excludes dev session capability and identifiers from production variants', () => {
    const androidRoot = path.join(__dirname, '../../android/app');
    const androidBase = fs.readFileSync(
      path.join(
        androidRoot,
        'src/main/java/so/onekey/app/wallet/BaseMainApplication.java',
      ),
      'utf8',
    );
    const androidDebug = fs.readFileSync(
      path.join(
        androidRoot,
        'src/debug/java/so/onekey/app/wallet/MainApplication.java',
      ),
      'utf8',
    );
    const androidRelease = fs.readFileSync(
      path.join(
        androidRoot,
        'src/release/java/so/onekey/app/wallet/MainApplication.java',
      ),
      'utf8',
    );
    const androidBuild = fs.readFileSync(
      path.join(androidRoot, 'build.gradle'),
      'utf8',
    );
    const androidReleaseConfig = androidBuild.slice(
      androidBuild.indexOf('        release {'),
      androidBuild.indexOf('    flavorDimensions'),
    );
    const iosSource = fs.readFileSync(
      path.join(__dirname, '../../ios/AppDelegate.swift'),
      'utf8',
    );
    const iosProductionSource = stripSwiftDevShellBlocks(iosSource);
    const productionInfo = fs.readFileSync(
      path.join(__dirname, '../../ios/OneKeyWallet/Info.plist'),
      'utf8',
    );
    const devOnlyIdentifiers = [
      'onekey-dev-sessions',
      'resolver.devSessionId',
      'ONEKEY_NATIVE_CONTRACT_KEY',
    ];

    for (const identifier of devOnlyIdentifiers) {
      expect(androidBase).not.toContain(identifier);
      expect(androidRelease).not.toContain(identifier);
      expect(androidReleaseConfig).not.toContain(identifier);
      expect(iosProductionSource).not.toContain(identifier);
      expect(productionInfo).not.toContain(identifier);
      expect(iosSource).toContain(identifier);
    }
    expect(androidDebug).toContain('onekey-dev-sessions');
    expect(androidDebug).toContain('resolver.devSessionId');
    expect(androidReleaseConfig).not.toContain('ONEKEY_DEV_SHELL');
    expect(iosSource).toContain(
      '#if ONEKEY_DEV_SHELL && DEBUG && targetEnvironment(simulator)',
    );

    expect(androidDebug).toContain(
      'buildDevVendorEntryUrl(metroBaseUrl, sessionId, "main", fingerprint)',
    );
    expect(androidDebug).toContain(
      'buildDevVendorEntryUrl(metroBaseUrl, sessionId, "background", fingerprint)',
    );
    expect(iosSource).toContain(
      'private lazy var devVendorBundleInfo = resolveDevVendorBundleInfo()',
    );
    expect(iosSource).toContain('runtimeTarget: "main"');
    expect(iosSource).toContain('runtimeTarget: "background"');
  });

  it('creates an input-bound ARM shell artifact manifest', async () => {
    const artifactPath = path.join(temporaryDirectory, 'OneKeyWallet.apk');
    const receiptPath = path.join(temporaryDirectory, 'receipt.json');
    const outputPath = path.join(temporaryDirectory, 'artifact.json');
    const artifact = Buffer.from('android-shell');
    fs.writeFileSync(artifactPath, artifact);
    fs.writeFileSync(
      receiptPath,
      JSON.stringify({
        inputKey: '1'.repeat(64),
        ociDigest: `sha256:${'2'.repeat(64)}`,
        outputTreeDigest: '3'.repeat(64),
        reference: 'ghcr.io/onekeyhq/web-embed-prebundle:test',
      }),
    );

    const manifest = await writeArtifactManifest({
      artifact: artifactPath,
      expectedWebEmbedInputKey: '1'.repeat(64),
      output: outputPath,
      platform: 'android',
      webEmbedReceipt: receiptPath,
    });

    expect(manifest).toMatchObject({
      architecture: 'arm64-v8a',
      artifact: {
        bytes: artifact.length,
        file: 'OneKeyWallet.apk',
        sha256: crypto.createHash('sha256').update(artifact).digest('hex'),
      },
      platform: 'android',
      schemaVersion: 3,
      webEmbed: {
        inputKey: '1'.repeat(64),
        ociDigest: `sha256:${'2'.repeat(64)}`,
        outputTreeDigest: '3'.repeat(64),
      },
    });
    expect(manifest.nativeContractKey).toMatch(/^[0-9a-f]{64}$/u);
    const computeExpectedArtifactKey = (shellInputKey) =>
      crypto
        .createHash('sha256')
        .update('onekey-mobile-dev-shell-artifact-v3')
        .update('\0')
        .update(shellInputKey)
        .update('\0')
        .update(manifest.artifact.sha256)
        .update('\0')
        .update(String(artifact.length))
        .update('\0')
        .digest('hex');
    expect(manifest.shellArtifactKey).toBe(
      computeExpectedArtifactKey(manifest.shellInputKey),
    );
    expect(computeExpectedArtifactKey('f'.repeat(64))).not.toBe(
      manifest.shellArtifactKey,
    );
    expect(manifest.shellCompatibilityKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(manifest.shellInputKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.parse(fs.readFileSync(outputPath, 'utf8'))).toEqual(manifest);
  });

  it('records a canonical local web-embed fallback in the shell manifest', async () => {
    const artifactPath = path.join(temporaryDirectory, 'OneKeyWallet.apk');
    const receiptPath = path.join(temporaryDirectory, 'receipt.json');
    const outputPath = path.join(temporaryDirectory, 'artifact.json');
    fs.writeFileSync(artifactPath, 'android-shell');
    fs.writeFileSync(
      receiptPath,
      JSON.stringify({
        inputKey: '1'.repeat(64),
        outputTreeDigest: '3'.repeat(64),
        schemaVersion: 1,
      }),
    );

    const manifest = await writeArtifactManifest({
      artifact: artifactPath,
      expectedWebEmbedInputKey: '1'.repeat(64),
      output: outputPath,
      platform: 'android',
      webEmbedReceipt: receiptPath,
    });

    expect(manifest.webEmbed).toEqual({
      inputKey: '1'.repeat(64),
      outputTreeDigest: '3'.repeat(64),
      source: 'local-build',
    });
  });

  it('derives a discoverable compatibility tag before building the shell', () => {
    const compatibility = getShellCompatibility({
      nativeContractKey: '4'.repeat(64),
      platform: 'ios',
    });

    expect(compatibility).toMatchObject({
      architecture: 'arm64',
      artifactFile: 'OneKeyWallet-DevShell-ios-simulator-arm64.zip',
      nativeContractKey: '4'.repeat(64),
      platform: 'ios',
      resourcePlatform: 'ios-simulator',
    });
    expect(compatibility.shellCompatibilityKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(compatibility.shellInputKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(compatibility.compatibilityTag).toBe(
      `mobile-dev-shell-contract-v3-ios-simulator-arm64-${compatibility.shellCompatibilityKey}`,
    );
    expect(compatibility.exactTag).toBe(
      `mobile-dev-shell-input-v3-ios-simulator-arm64-${compatibility.shellInputKey}`,
    );
    expect(
      getShellArtifactTag({
        platform: 'ios',
        shellArtifactKey: '6'.repeat(64),
      }),
    ).toBe(
      `mobile-dev-shell-artifact-v3-ios-simulator-arm64-${'6'.repeat(64)}`,
    );
  });

  it('rejects a directory as a shell artifact', async () => {
    const receiptPath = path.join(temporaryDirectory, 'receipt.json');
    fs.writeFileSync(
      receiptPath,
      JSON.stringify({
        inputKey: '1'.repeat(64),
        ociDigest: `sha256:${'2'.repeat(64)}`,
        outputTreeDigest: '3'.repeat(64),
      }),
    );

    await expect(
      writeArtifactManifest({
        artifact: temporaryDirectory,
        expectedWebEmbedInputKey: '1'.repeat(64),
        output: path.join(temporaryDirectory, 'artifact.json'),
        platform: 'ios',
        webEmbedReceipt: receiptPath,
      }),
    ).rejects.toThrow('Artifact must be a regular file');
  });
});
