import { ReactNativeBundleUpdate } from '@onekeyfe/react-native-bundle-update';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { appRestart } from '../appRestart';

import { BundleUpdate, resetBundleInstallLockForTest } from './index.native';

jest.mock('@onekeyfe/react-native-bundle-update', () => ({
  ReactNativeBundleUpdate: { installBundle: jest.fn() },
}));

jest.mock('../appRestart', () => ({ appRestart: jest.fn() }));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { appUpdate: { restartRNApp: jest.fn(), log: jest.fn() } },
  },
}));

const installBundle = jest.spyOn(ReactNativeBundleUpdate, 'installBundle');
const restart = jest.mocked(appRestart);
const emitToSelf = jest.spyOn(appEventBus, 'emitToSelf');
const broadcast = jest.spyOn(appEventBus, 'emit');

describe('native bundle install concurrency', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    emitToSelf.mockClear();
    broadcast.mockClear();
    resetBundleInstallLockForTest();
    installBundle.mockReset().mockResolvedValue(undefined);
    restart.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('overlapping callers receive the native failure and can retry', async () => {
    let rejectInstall: (error: Error) => void = () => {};
    installBundle.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectInstall = reject;
        }),
    );
    const first = BundleUpdate.installBundle({});
    const second = BundleUpdate.installBundle({});
    const outcome = Promise.allSettled([first, second]);
    const error = new Error('Bundle directory not found');
    rejectInstall(error);

    await expect(outcome).resolves.toEqual([
      { status: 'rejected', reason: error },
      { status: 'rejected', reason: error },
    ]);
    expect(installBundle).toHaveBeenCalledTimes(1);
    expect(restart).not.toHaveBeenCalled();

    const retry = BundleUpdate.installBundle({
      latestVersion: '6.6.2',
      bundleVersion: '25000000',
    });
    await jest.runAllTimersAsync();
    await retry;
    expect(installBundle).toHaveBeenCalledTimes(2);
  });

  test.each([
    { latestVersion: '6.6.2', bundleVersion: '24910529' },
    { latestVersion: '6.6.1', bundleVersion: '24910530' },
  ])(
    'rejects a different target during and after installation: %j',
    async (conflictingTarget) => {
      let completeInstall = () => {};
      installBundle.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            completeInstall = resolve;
          }),
      );
      const target = { latestVersion: '6.6.1', bundleVersion: '24910529' };
      const first = BundleUpdate.installBundle(target);
      await expect(
        BundleUpdate.installBundle(conflictingTarget),
      ).rejects.toThrow('BUNDLE_INSTALL_TARGET_CONFLICT');
      expect(installBundle).toHaveBeenCalledTimes(1);

      completeInstall();
      await first;
      await expect(
        BundleUpdate.installBundle(conflictingTarget),
      ).rejects.toThrow('BUNDLE_INSTALL_TARGET_CONFLICT');
      await BundleUpdate.installBundle({ ...target });
      expect(installBundle).toHaveBeenCalledTimes(1);
    },
  );

  test('resolves installation before a non-returning restart and keeps it one-shot', async () => {
    restart.mockImplementationOnce(() => new Promise<void>(() => {}));
    let settled = false;
    const first = BundleUpdate.installBundle({}).then(() => {
      settled = true;
    });
    const second = BundleUpdate.installBundle({});
    await jest.advanceTimersByTimeAsync(2499);
    expect(restart).not.toHaveBeenCalled();
    expect(settled).toBe(true);

    await jest.advanceTimersByTimeAsync(1);
    expect(restart).toHaveBeenCalledTimes(1);
    expect(settled).toBe(true);
    await Promise.all([first, second]);
    await BundleUpdate.installBundle({});
    expect(installBundle).toHaveBeenCalledTimes(1);
    expect(restart).toHaveBeenCalledTimes(1);
  });

  test('notifies only this runtime and retries only restart after delayed restart failure', async () => {
    const error = new Error('Restart failed');
    restart.mockRejectedValueOnce(error);
    const outcome = Promise.allSettled([
      BundleUpdate.installBundle({}),
      BundleUpdate.installBundle({}),
    ]);
    await jest.runAllTimersAsync();

    await expect(outcome).resolves.toEqual([
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
    ]);
    expect(emitToSelf).toHaveBeenCalledWith({
      type: EAppEventBusNames.BundleUpdateRestartFailed,
      payload: undefined,
    });
    expect(broadcast).not.toHaveBeenCalled();

    await expect(
      BundleUpdate.installBundle({
        latestVersion: '6.6.2',
        bundleVersion: '25000000',
      }),
    ).rejects.toThrow('BUNDLE_INSTALL_TARGET_CONFLICT');
    expect(restart).toHaveBeenCalledTimes(1);

    const retry = BundleUpdate.installBundle({});
    await jest.runAllTimersAsync();
    await retry;
    expect(installBundle).toHaveBeenCalledTimes(1);
    expect(restart).toHaveBeenCalledTimes(2);
  });
});
