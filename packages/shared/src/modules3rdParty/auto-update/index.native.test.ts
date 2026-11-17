import { ReactNativeBundleUpdate } from '@onekeyfe/react-native-bundle-update';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { OneKeyLocalError } from '../../errors';
import { appRestart } from '../appRestart';

import { EUpdateErrorCode, createUpdateError, getUpdateError } from './error';
import {
  AppUpdate,
  BundleUpdate,
  resetBundleInstallLockForTest,
} from './index.native';

import type { IAppUpdateInfo } from '../../appUpdate';

jest.mock('@onekeyfe/react-native-bundle-update', () => ({
  ReactNativeBundleUpdate: {
    installBundle: jest.fn(),
    setCurrentUpdateBundleData: jest.fn(),
  },
}));
jest.mock('@onekeyfe/react-native-app-update', () => ({
  ReactNativeAppUpdate: {
    verifyASC: jest.fn(),
    verifyAPK: jest.fn(),
    installAPK: jest.fn(),
  },
}));
jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroidGooglePlay: false,
    isNativeAndroidHuawei: false,
  },
}));
jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    update: { app: { log: jest.fn() } },
    app: { appUpdate: { restartRNApp: jest.fn(), log: jest.fn() } },
  },
}));
jest.mock('../appRestart', () => ({ appRestart: jest.fn() }));

const nativeUpdate = (
  jest.requireMock('@onekeyfe/react-native-app-update') as {
    ReactNativeAppUpdate: {
      verifyASC: jest.Mock;
      verifyAPK: jest.Mock;
      installAPK: jest.Mock;
    };
  }
).ReactNativeAppUpdate;

const downloadUrl = 'https://example.com/update.apk';
const installParams = {
  latestVersion: '2.0.0',
  downloadUrl,
} as IAppUpdateInfo;

describe('native app update proof recovery', () => {
  let ascProof = false;
  let packageProof = false;

  beforeEach(() => {
    jest.clearAllMocks();
    ascProof = false;
    packageProof = false;
    nativeUpdate.verifyASC.mockImplementation(async () => {
      ascProof = true;
    });
    nativeUpdate.verifyAPK.mockImplementation(async () => {
      if (!ascProof) throw new OneKeyLocalError('missing ASC proof');
      packageProof = true;
    });
    nativeUpdate.installAPK.mockImplementation(async () => {
      if (!packageProof) throw new OneKeyLocalError('missing package proof');
    });
  });

  test('verifyPackage rebuilds cold native ASC proof before package check', async () => {
    await AppUpdate.verifyPackage({ downloadUrl });

    expect(nativeUpdate.verifyASC).toHaveBeenCalledWith({ downloadUrl });
    expect(nativeUpdate.verifyAPK).toHaveBeenCalledWith({ downloadUrl });
    expect(nativeUpdate.verifyASC.mock.invocationCallOrder[0]).toBeLessThan(
      nativeUpdate.verifyAPK.mock.invocationCallOrder[0],
    );
  });

  test('install rebuilds both cold native proofs before installer launch', async () => {
    await expect(AppUpdate.installPackage(installParams)).resolves.toBe(true);

    expect(nativeUpdate.verifyASC.mock.invocationCallOrder[0]).toBeLessThan(
      nativeUpdate.verifyAPK.mock.invocationCallOrder[0],
    );
    expect(nativeUpdate.verifyAPK.mock.invocationCallOrder[0]).toBeLessThan(
      nativeUpdate.installAPK.mock.invocationCallOrder[0],
    );
  });

  test('ASC failure keeps its code at the public verifyPackage step', async () => {
    nativeUpdate.verifyASC.mockRejectedValueOnce(
      new Error(
        'ONEKEY_UPDATE_ERROR:{"code":"INTEGRITY_FAILED","step":"verifyASC"}',
      ),
    );

    const failure = await AppUpdate.verifyPackage({ downloadUrl }).catch(
      (error: unknown) => error,
    );
    expect(getUpdateError(failure, 'verifyPackage')).toEqual({
      code: EUpdateErrorCode.integrityFailed,
      step: 'verifyPackage',
    });
    expect(nativeUpdate.verifyAPK).not.toHaveBeenCalled();
  });

  test('package verification failure blocks installer with public install step', async () => {
    nativeUpdate.verifyAPK.mockRejectedValueOnce(
      new Error(
        'ONEKEY_UPDATE_ERROR:{"code":"INCOMPATIBLE","step":"verifyPackage"}',
      ),
    );

    const failure = await AppUpdate.installPackage(installParams).catch(
      (error: unknown) => error,
    );
    expect(getUpdateError(failure, 'install')).toEqual({
      code: EUpdateErrorCode.incompatible,
      step: 'install',
    });
    expect(nativeUpdate.installAPK).not.toHaveBeenCalled();
  });

  test('ASC failure blocks cold install and keeps the public install step', async () => {
    nativeUpdate.verifyASC.mockRejectedValueOnce(
      new Error(
        'ONEKEY_UPDATE_ERROR:{"code":"INTEGRITY_FAILED","step":"verifyASC"}',
      ),
    );

    const failure = await AppUpdate.installPackage(installParams).catch(
      (error: unknown) => error,
    );
    expect(getUpdateError(failure, 'install')).toEqual({
      code: EUpdateErrorCode.integrityFailed,
      step: 'install',
    });
    expect(nativeUpdate.verifyAPK).not.toHaveBeenCalled();
    expect(nativeUpdate.installAPK).not.toHaveBeenCalled();
  });
});

const installBundle = jest.spyOn(ReactNativeBundleUpdate, 'installBundle');
const restart = jest.mocked(appRestart);
const setCurrentBundle = jest.spyOn(
  ReactNativeBundleUpdate,
  'setCurrentUpdateBundleData',
);
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
    setCurrentBundle.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test.each(['restart', 'switchBundle'] as const)(
    '%s exposes delayed restart failure and allows retry',
    async (action) => {
      const target = {
        appVersion: '6.6.1',
        bundleVersion: '24910529',
        signature: 'signature',
      };
      const run = () =>
        action === 'restart'
          ? BundleUpdate.restart()
          : BundleUpdate.switchBundle(target);
      const error = new Error('BG_RESTART_ERROR');
      restart.mockRejectedValueOnce(error);
      const result = Promise.allSettled([run()]);
      await jest.advanceTimersByTimeAsync(2499);
      expect(restart).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      await expect(result).resolves.toMatchObject([
        {
          status: 'rejected',
          reason: {
            data: {
              updateError: {
                code: EUpdateErrorCode.installFailed,
                step: 'install',
              },
            },
          },
        },
      ]);
      expect(restart).toHaveBeenCalledWith({
        mode: 'all',
        reason: `ota.${action}`,
      });
      expect(emitToSelf).not.toHaveBeenCalled();

      const retry = run();
      await jest.runAllTimersAsync();
      await retry;
      expect(restart).toHaveBeenCalledTimes(2);
      expect(installBundle).not.toHaveBeenCalled();
    },
  );

  test('does not restart when switching bundle metadata fails', async () => {
    const error = createUpdateError({
      code: EUpdateErrorCode.packageMissing,
      step: 'install',
    });
    setCurrentBundle.mockRejectedValueOnce(error);
    await expect(
      BundleUpdate.switchBundle({
        appVersion: '6.6.1',
        bundleVersion: '24910529',
        signature: 'signature',
      }),
    ).rejects.toMatchObject({
      data: { updateError: getUpdateError(error, 'install') },
    });
    await jest.runAllTimersAsync();
    expect(restart).not.toHaveBeenCalled();
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
    const error = createUpdateError({
      code: EUpdateErrorCode.packageMissing,
      step: 'install',
    });
    rejectInstall(error);

    await expect(outcome).resolves.toMatchObject([
      {
        status: 'rejected',
        reason: { data: { updateError: getUpdateError(error, 'install') } },
      },
      {
        status: 'rejected',
        reason: { data: { updateError: getUpdateError(error, 'install') } },
      },
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

    await expect(outcome).resolves.toMatchObject([
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
    ]);
    expect(emitToSelf).toHaveBeenCalledWith({
      type: EAppEventBusNames.BundleUpdateRestartFailed,
      payload: undefined,
    });
    expect(broadcast).not.toHaveBeenCalled();

    expect(restart).toHaveBeenCalledTimes(1);

    const retry = BundleUpdate.installBundle({});
    await expect(
      BundleUpdate.installBundle({
        latestVersion: '6.6.1',
        bundleVersion: '24910530',
      }),
    ).rejects.toThrow('BUNDLE_INSTALL_TARGET_CONFLICT');
    await jest.runAllTimersAsync();
    await retry;
    expect(installBundle).toHaveBeenCalledTimes(1);
    expect(restart).toHaveBeenCalledTimes(2);
  });

  test('accepts a new target after restart failure without reinstalling the previous target', async () => {
    restart.mockRejectedValueOnce(new Error('Restart failed'));
    const firstTarget = { latestVersion: '6.6.1', bundleVersion: '24910529' };
    await BundleUpdate.installBundle(firstTarget);
    await jest.runAllTimersAsync();

    const nextTarget = { latestVersion: '6.6.1', bundleVersion: '24910530' };
    await Promise.all([
      BundleUpdate.installBundle(nextTarget),
      BundleUpdate.installBundle({ ...nextTarget }),
    ]);
    await expect(BundleUpdate.installBundle(firstTarget)).rejects.toThrow(
      'BUNDLE_INSTALL_TARGET_CONFLICT',
    );
    await jest.runAllTimersAsync();

    expect(installBundle).toHaveBeenCalledTimes(2);
    expect(installBundle).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining(nextTarget),
    );
    expect(restart).toHaveBeenCalledTimes(2);
  });
});
