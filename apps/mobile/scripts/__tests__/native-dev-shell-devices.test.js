/* eslint-disable onekey/no-raw-error */
/* cspell:words devicectl */

const { PassThrough } = require('stream');

const {
  getIosPhysicalAppProcessIds,
  isAvailableIosPhysicalDevice,
  launchIosPhysicalApp,
  launchIosPhysicalDeviceDevelopment,
  promptIosSimulator,
  resolveIosPhysicalBuildArtifact,
  resolveTargetDevice,
  waitForIosPhysicalAppStartup,
} = require('../native-dev-shell');

function createSimulator(id, state = 'Shutdown') {
  return { isAvailable: true, name: `iPhone ${id}`, state, udid: id };
}

function createResolution(devices, overrides = {}) {
  const options = {
    chooseDevice: jest.fn(async (candidates) => candidates[1]),
    interactive: true,
    isIosPhysicalDeviceAvailable: jest.fn(() => false),
    platform: 'ios',
    runCheckedCommand: jest.fn(),
    runForOutputCommand: jest.fn(() =>
      JSON.stringify({
        devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-26-5': devices },
      }),
    ),
    ...overrides,
  };
  return options;
}

describe('iOS simulator selection', () => {
  it('automatically boots a sole shutdown simulator before opening Simulator', async () => {
    const options = createResolution([createSimulator('A')]);

    await expect(resolveTargetDevice(options)).resolves.toMatchObject({
      id: 'A',
    });

    expect(options.chooseDevice).not.toHaveBeenCalled();
    expect(options.runCheckedCommand.mock.calls).toEqual([
      ['xcrun', ['simctl', 'bootstatus', 'A', '-b']],
      ['open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', 'A']],
    ]);
  });

  it('prefers the sole booted simulator without prompting', async () => {
    const options = createResolution([
      createSimulator('A', 'Booted'),
      createSimulator('B'),
    ]);

    await expect(resolveTargetDevice(options)).resolves.toMatchObject({
      id: 'A',
    });
    expect(options.chooseDevice).not.toHaveBeenCalled();
  });

  it.each(['Shutdown', 'Booted'])(
    'prompts for multiple %s simulators and boots only the selected device',
    async (state) => {
      const options = createResolution([
        createSimulator('A', state),
        createSimulator('B', state),
      ]);

      await expect(resolveTargetDevice(options)).resolves.toMatchObject({
        id: 'B',
      });
      expect(options.chooseDevice).toHaveBeenCalledWith([
        { id: 'A', name: 'iPhone A', runtime: 'iOS 26.5', state },
        { id: 'B', name: 'iPhone B', runtime: 'iOS 26.5', state },
      ]);
      expect(options.runCheckedCommand).toHaveBeenNthCalledWith(1, 'xcrun', [
        'simctl',
        'bootstatus',
        'B',
        '-b',
      ]);
    },
  );

  it('honors an explicit shutdown device even if another simulator is booted', async () => {
    const options = createResolution(
      [createSimulator('A', 'Booted'), createSimulator('B')],
      { requestedDevice: 'B', interactive: false },
    );

    await expect(resolveTargetDevice(options)).resolves.toMatchObject({
      id: 'B',
    });
    expect(options.chooseDevice).not.toHaveBeenCalled();
  });

  it('routes an explicit physical device without running Simulator commands', async () => {
    const options = createResolution([createSimulator('A')], {
      isIosPhysicalDeviceAvailable: jest.fn(() => true),
      requestedDevice: 'PHYSICAL-DEVICE',
    });

    await expect(resolveTargetDevice(options)).resolves.toEqual({
      id: 'PHYSICAL-DEVICE',
      name: 'PHYSICAL-DEVICE',
      physical: true,
    });
    expect(options.isIosPhysicalDeviceAvailable).toHaveBeenCalledWith(
      'PHYSICAL-DEVICE',
    );
    expect(options.runCheckedCommand).not.toHaveBeenCalled();
  });

  it('lists shutdown devices and an explicit command in a non-interactive terminal', async () => {
    const options = createResolution(
      [createSimulator('A'), createSimulator('B')],
      { interactive: false },
    );

    await expect(resolveTargetDevice(options)).rejects.toThrow(
      'Run yarn app:ios --device <UDID>. Available devices:\n- A (iPhone A, iOS 26.5, Shutdown)\n- B (iPhone B, iOS 26.5, Shutdown)',
    );
    expect(options.chooseDevice).not.toHaveBeenCalled();
    expect(options.runCheckedCommand).not.toHaveBeenCalled();
  });

  it('explains how to create a simulator when none are installed', async () => {
    const options = createResolution([]);

    await expect(resolveTargetDevice(options)).rejects.toThrow(
      'No available iOS simulators. Create an iOS simulator in Xcode',
    );
    expect(options.chooseDevice).not.toHaveBeenCalled();
    expect(options.runCheckedCommand).not.toHaveBeenCalled();
  });

  it('rejects an unavailable explicit device without booting another one', async () => {
    const options = createResolution([createSimulator('A')], {
      requestedDevice: 'missing',
    });

    await expect(resolveTargetDevice(options)).rejects.toThrow(
      'Device missing is not available',
    );
    expect(options.isIosPhysicalDeviceAvailable).toHaveBeenCalledWith(
      'missing',
    );
    expect(options.runCheckedCommand).not.toHaveBeenCalled();
  });

  it('recognizes iOS physical devices through CoreDevice', () => {
    const runForOutputCommand = jest.fn(() => '');

    expect(
      isAvailableIosPhysicalDevice('PHYSICAL-DEVICE', {
        runForOutputCommand,
      }),
    ).toBe(true);
    expect(runForOutputCommand).toHaveBeenCalledWith('xcrun', [
      'devicectl',
      'device',
      'info',
      'details',
      '--device',
      'PHYSICAL-DEVICE',
      '--timeout',
      '5',
      '--quiet',
    ]);

    expect(
      isAvailableIosPhysicalDevice('MISSING', {
        runForOutputCommand: () => {
          throw new Error('not found');
        },
      }),
    ).toBe(false);
  });

  it('owns the physical-device Metro, build, install, launch, and run report', async () => {
    const releaseDeviceLock = jest.fn();
    const releaseMetroLock = jest.fn();
    const releasePreparationLock = jest.fn();
    const child = new PassThrough();
    child.exitCode = null;
    child.signalCode = null;
    child.kill = jest.fn();
    const runCheckedCommand = jest.fn();
    const spawnMetroCommand = jest.fn(() => child);
    const writeRunReportCommand = jest.fn(async () => {});
    const printRunSummaryCommand = jest.fn();
    const prewarmCommand = jest.fn(async () => {});
    const launchAppCommand = jest.fn(() => ({ processId: 42 }));

    await expect(
      launchIosPhysicalDeviceDevelopment({
        acquireMetroPortCommand: jest.fn(async () => ({
          lock: { release: releaseMetroLock },
          port: 8082,
        })),
        acquireNamedLockCommand: jest.fn(() => ({
          release: releaseDeviceLock,
        })),
        acquirePreparationLockCommand: jest.fn(async () => ({
          release: releasePreparationLock,
        })),
        deviceId: 'PHYSICAL-DEVICE',
        launchAppCommand,
        loadVendorManifestCommand: jest.fn(() => ({
          fingerprint: 'a'.repeat(64),
        })),
        prepareVendorCommand: jest.fn(async ({ report }) => {
          report.vendor = {
            requested: 'auto',
            source: 'local-cache',
            status: 'ready',
          };
        }),
        prewarmCommand,
        printRunSummaryCommand,
        resolveBuildArtifactCommand: jest.fn(() => '/tmp/OneKeyWallet.app'),
        runCheckedCommand,
        shell: 'auto',
        spawnMetroCommand,
        vendor: 'auto',
        waitForAppStartupCommand: jest.fn(async () => {
          child.exitCode = 0;
          child.emit('exit', 0, null);
        }),
        waitForMetroCommand: jest.fn(async () => {}),
        writeRunReportCommand,
      }),
    ).resolves.toBeUndefined();
    expect(spawnMetroCommand).toHaveBeenCalledWith(
      'yarn',
      [
        'workspace',
        '@onekeyhq/mobile',
        'native-bundle',
        '--port',
        '8082',
        '--host',
        '0.0.0.0',
      ],
      expect.objectContaining({
        cwd: expect.any(String),
        env: expect.objectContaining({
          ONEKEY_DEV_BG_HMR: 'true',
          ONEKEY_DEV_VENDOR: 'true',
        }),
        stdio: 'inherit',
      }),
    );
    expect(runCheckedCommand).toHaveBeenCalledWith(
      'xcodebuild',
      expect.arrayContaining([
        '-workspace',
        'OneKeyWallet.xcworkspace',
        '-configuration',
        'Debug',
        '-destination',
        'id=PHYSICAL-DEVICE',
        '-quiet',
      ]),
      expect.objectContaining({
        cwd: expect.stringMatching(/apps\/mobile\/ios$/u),
        env: expect.objectContaining({
          ONEKEY_DEV_BG_HMR: 'true',
          ONEKEY_DEV_VENDOR: 'true',
          RCT_NO_LAUNCH_PACKAGER: 'true',
        }),
      }),
    );
    expect(runCheckedCommand).toHaveBeenCalledWith('xcrun', [
      'devicectl',
      'device',
      'install',
      'app',
      '--device',
      'PHYSICAL-DEVICE',
      '--quiet',
      '/tmp/OneKeyWallet.app',
    ]);
    expect(prewarmCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        backgroundHMR: true,
        embedded: true,
        metroPort: 8082,
      }),
    );
    expect(writeRunReportCommand).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'finished' }),
    );
    expect(printRunSummaryCommand).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'finished' }),
    );
    expect(releasePreparationLock).toHaveBeenCalledTimes(1);
    expect(releasePreparationLock.mock.invocationCallOrder[0]).toBeGreaterThan(
      runCheckedCommand.mock.invocationCallOrder[
        runCheckedCommand.mock.invocationCallOrder.length - 1
      ],
    );
    expect(releasePreparationLock.mock.invocationCallOrder[0]).toBeLessThan(
      launchAppCommand.mock.invocationCallOrder[0],
    );
    expect(releaseMetroLock).toHaveBeenCalledTimes(1);
    expect(releaseDeviceLock).toHaveBeenCalledTimes(1);
  });

  it('releases physical-device locks when installation fails', async () => {
    const releaseDeviceLock = jest.fn();
    const releaseMetroLock = jest.fn();
    const releasePreparationLock = jest.fn();
    const child = new PassThrough();
    child.exitCode = null;
    child.signalCode = null;
    child.kill = jest.fn();

    await expect(
      launchIosPhysicalDeviceDevelopment({
        acquireMetroPortCommand: jest.fn(async () => ({
          lock: { release: releaseMetroLock },
          port: 8082,
        })),
        acquireNamedLockCommand: jest.fn(() => ({
          release: releaseDeviceLock,
        })),
        acquirePreparationLockCommand: jest.fn(async () => ({
          release: releasePreparationLock,
        })),
        deviceId: 'PHYSICAL-DEVICE',
        loadVendorManifestCommand: jest.fn(() => ({
          fingerprint: 'a'.repeat(64),
        })),
        prepareVendorCommand: jest.fn(async () => {}),
        prewarmCommand: jest.fn(async () => {}),
        printRunSummaryCommand: jest.fn(),
        resolveBuildArtifactCommand: jest.fn(() => '/tmp/OneKeyWallet.app'),
        runCheckedCommand: jest.fn((command, args) => {
          if (command === 'xcrun' && args.includes('install')) {
            throw new Error('install failed');
          }
        }),
        shell: 'auto',
        spawnMetroCommand: jest.fn(() => child),
        vendor: 'auto',
        waitForMetroCommand: jest.fn(async () => {}),
        writeRunReportCommand: jest.fn(async () => {}),
      }),
    ).rejects.toThrow('install failed');
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(releasePreparationLock).toHaveBeenCalledTimes(1);
    expect(releaseMetroLock).toHaveBeenCalledTimes(1);
    expect(releaseDeviceLock).toHaveBeenCalledTimes(1);
  });

  it('injects the allocated Metro port when launching the physical app', () => {
    const runDevicectlJsonCommand = jest.fn((createArgs) => {
      expect(createArgs('/tmp/result.json')).toEqual([
        'device',
        'process',
        'launch',
        '--device',
        'PHYSICAL-DEVICE',
        '--terminate-existing',
        '--environment-variables',
        '{"RCT_METRO_PORT":"8082"}',
        '--json-output',
        '/tmp/result.json',
        '--quiet',
        'so.onekey.wallet',
      ]);
      return { result: { process: { processIdentifier: 42 } } };
    });

    expect(
      launchIosPhysicalApp('PHYSICAL-DEVICE', 8082, {
        runDevicectlJsonCommand,
      }),
    ).toEqual({ processId: 42 });
  });

  it('requires the launched physical app process to survive startup', async () => {
    const wait = jest.fn(async () => {});
    const readProcessIds = jest.fn(() => [42]);

    await expect(
      waitForIosPhysicalAppStartup({
        deviceId: 'PHYSICAL-DEVICE',
        pollIntervalMs: 1000,
        processId: 42,
        readProcessIds,
        startupGraceMs: 2000,
        wait,
      }),
    ).resolves.toBeUndefined();
    expect(readProcessIds).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it('reads physical app processes from devicectl JSON', () => {
    const runDevicectlJsonCommand = jest.fn((createArgs) => {
      expect(createArgs('/tmp/result.json')).not.toContain('--filter');
      return {
        result: {
          runningProcesses: [
            {
              executable:
                'file:///private/var/containers/Bundle/Application/ID/OneKeyWallet.app/OneKeyWallet',
              processIdentifier: 42,
            },
            {
              executable: 'file:///usr/libexec/unrelated',
              processIdentifier: 7,
            },
            {
              executable:
                'file:///private/var/containers/Bundle/Application/ID/OneKeyWallet.app/OneKeyWallet',
              processIdentifier: 'invalid',
            },
          ],
        },
      };
    });

    expect(
      getIosPhysicalAppProcessIds('PHYSICAL-DEVICE', {
        runDevicectlJsonCommand,
      }),
    ).toEqual([42]);
  });

  it('resolves the physical iOS app from Xcode build settings', () => {
    const runForOutputCommand = jest.fn(() =>
      JSON.stringify([
        {
          buildSettings: {
            TARGET_BUILD_DIR: '/tmp/Debug-iphoneos',
            WRAPPER_NAME: 'OneKeyWallet.app',
          },
          target: 'OneKeyWallet',
        },
      ]),
    );
    expect(
      resolveIosPhysicalBuildArtifact('PHYSICAL-DEVICE', {
        fileSystem: { existsSync: () => true },
        runForOutputCommand,
      }),
    ).toBe('/tmp/Debug-iphoneos/OneKeyWallet.app');
    expect(runForOutputCommand).toHaveBeenCalledWith(
      'xcodebuild',
      expect.arrayContaining([
        '-destination',
        'id=PHYSICAL-DEVICE',
        '-showBuildSettings',
        '-json',
      ]),
      expect.objectContaining({
        cwd: expect.stringMatching(/apps\/mobile\/ios$/u),
      }),
    );
  });

  it('rejects DevSession-only overrides for physical devices', async () => {
    await expect(
      launchIosPhysicalDeviceDevelopment({
        deviceId: 'PHYSICAL-DEVICE',
        metroUrl: 'http://192.168.1.2:8081',
        shell: 'auto',
        spawnCommand: jest.fn(),
        vendor: 'auto',
      }),
    ).rejects.toThrow(
      'does not support DevSession shell, vendor, or --metro-url overrides',
    );
  });

  it('keeps the physical-device command on the prepared DevVendor path', () => {
    const rootPackage = require('../../../../package.json');
    const mobilePackage = require('../../package.json');

    expect(rootPackage.scripts['app:ios:device']).toContain(
      'dev-vendor:prepare:ios',
    );
    expect(rootPackage.scripts['app:ios:device']).toContain(
      'ONEKEY_DEV_VENDOR=true ONEKEY_DEV_BG_HMR=true',
    );
    expect(mobilePackage.scripts['dev-vendor:prepare:ios']).toContain(
      '--prepare --platform ios',
    );
  });

  it('propagates simulator service failures instead of reporting an empty list', async () => {
    const options = createResolution([], {
      runForOutputCommand: () => {
        throw new Error('CoreSimulator unavailable');
      },
    });

    await expect(resolveTargetDevice(options)).rejects.toThrow(
      'CoreSimulator unavailable',
    );
    expect(options.chooseDevice).not.toHaveBeenCalled();
  });

  it('stops when selection is cancelled or booting fails', async () => {
    const cancelled = createResolution(
      [createSimulator('A'), createSimulator('B')],
      {
        chooseDevice: async () => {
          throw new Error('cancelled');
        },
      },
    );
    await expect(resolveTargetDevice(cancelled)).rejects.toThrow('cancelled');
    expect(cancelled.runCheckedCommand).not.toHaveBeenCalled();

    const bootFailure = createResolution([createSimulator('A')], {
      runCheckedCommand: jest.fn(() => {
        throw new Error('boot failed');
      }),
    });
    await expect(resolveTargetDevice(bootFailure)).rejects.toThrow(
      'boot failed',
    );
    expect(bootFailure.runCheckedCommand).toHaveBeenCalledTimes(1);
  });

  it('keeps Android selection free of simulator commands', async () => {
    const options = createResolution([], {
      platform: 'android',
      runForOutputCommand: () =>
        'List of devices attached\nemulator-5554 device\n',
    });

    await expect(resolveTargetDevice(options)).resolves.toEqual({
      id: 'emulator-5554',
      name: 'emulator-5554',
    });
    expect(options.chooseDevice).not.toHaveBeenCalled();
    expect(options.runCheckedCommand).not.toHaveBeenCalled();
  });

  it('shows device details, rejects invalid numbers and returns the chosen simulator', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const candidates = [
      { id: 'A', name: 'iPhone A', runtime: 'iOS 26.5', state: 'Shutdown' },
      { id: 'B', name: 'iPhone B', runtime: 'iOS 18.3', state: 'Booted' },
    ];
    const selection = promptIosSimulator(candidates, { input, output });
    input.write('0\n3\n1.5\nabc\n\n2\n');

    await expect(selection).resolves.toEqual(candidates[1]);
    const displayed = output.read().toString();
    expect(displayed).toContain('1. A (iPhone A, iOS 26.5, Shutdown)');
    expect(displayed).toContain('2. B (iPhone B, iOS 18.3, Booted)');
    expect(displayed.match(/Enter a number from 1 to 2/gu)).toHaveLength(5);
    input.destroy();
    output.destroy();
  });

  it('cancels cleanly when the terminal input closes', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const selection = promptIosSimulator([{ id: 'A', name: 'iPhone A' }], {
      input,
      output,
    });
    input.end();

    await expect(selection).rejects.toThrow(
      'iOS simulator selection cancelled',
    );
    input.destroy();
    output.destroy();
  });
});
