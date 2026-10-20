import { OneKeyLocalError } from '../../errors';

import { EUpdateErrorCode, getUpdateError } from './error';
import { AppUpdate } from './index.native';

import type { IAppUpdateInfo } from '../../appUpdate';

jest.mock('@onekeyfe/react-native-bundle-update', () => ({
  ReactNativeBundleUpdate: {},
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
  defaultLogger: { update: { app: { log: jest.fn() } } },
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
