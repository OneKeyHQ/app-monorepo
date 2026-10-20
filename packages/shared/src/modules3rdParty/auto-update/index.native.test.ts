import { ReactNativeBundleUpdate } from '@onekeyfe/react-native-bundle-update';

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

describe('native bundle install concurrency', () => {
  beforeEach(() => {
    jest.useFakeTimers();
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

    const retry = BundleUpdate.installBundle({});
    await jest.runAllTimersAsync();
    await retry;
    expect(installBundle).toHaveBeenCalledTimes(2);
  });

  test('keeps callers pending through the grace period and restart', async () => {
    let finishRestart: () => void = () => {};
    restart.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishRestart = resolve;
        }),
    );
    let settled = false;
    const first = BundleUpdate.installBundle({}).then(() => {
      settled = true;
    });
    const second = BundleUpdate.installBundle({});
    await jest.advanceTimersByTimeAsync(2499);
    expect(restart).not.toHaveBeenCalled();
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    expect(restart).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    finishRestart();
    await Promise.all([first, second]);
    await BundleUpdate.installBundle({});
    expect(installBundle).toHaveBeenCalledTimes(1);
    expect(restart).toHaveBeenCalledTimes(1);
  });

  test('propagates a delayed restart failure to all callers and releases the lock', async () => {
    const error = new Error('Restart failed');
    restart.mockRejectedValueOnce(error);
    const outcome = Promise.allSettled([
      BundleUpdate.installBundle({}),
      BundleUpdate.installBundle({}),
    ]);
    await jest.runAllTimersAsync();

    await expect(outcome).resolves.toEqual([
      { status: 'rejected', reason: error },
      { status: 'rejected', reason: error },
    ]);

    const retry = BundleUpdate.installBundle({});
    await jest.runAllTimersAsync();
    await retry;
    expect(installBundle).toHaveBeenCalledTimes(2);
    expect(restart).toHaveBeenCalledTimes(2);
  });
});
