import { DESKTOP_API_MESSAGE_TYPE } from '../base/consts';

import desktopApi from './desktopApi';

import type { IDesktopApiMessagePayload } from '../base/types';

const mockPrivateInstall = jest.fn();
const mockPublicStatus = jest.fn(async () => false);

jest.mock('@onekeyhq/shared/src/utils/cacheUtils', () => ({
  memoizee: <T>(fn: T) => fn,
}));
jest.mock('@onekeyhq/shared/src/platformEnvLite', () => ({
  __esModule: true,
  default: { isDesktop: true },
}));
jest.mock('../DesktopApiAppUpdate', () => ({
  __esModule: true,
  default: class {
    launchWindowsInstaller = mockPrivateInstall;

    isDownloadingPackage = mockPublicStatus;
  },
}));

function message(method: string): IDesktopApiMessagePayload {
  return {
    type: DESKTOP_API_MESSAGE_TYPE,
    module: 'appUpdate',
    method,
    params: [],
  };
}

test('desktopApi enforces the generated public visibility gate and removes legacy setup', async () => {
  expect('desktopApiSetup' in desktopApi).toBe(false);
  expect(() =>
    desktopApi.callDesktopApiMethod(message('launchWindowsInstaller')),
  ).toThrow('not public');
  expect(() => desktopApi.callDesktopApiMethod(message('toString'))).toThrow(
    'not public',
  );
  expect(mockPrivateInstall).not.toHaveBeenCalled();
  expect(
    await desktopApi.callDesktopApiMethod(message('isDownloadingPackage')),
  ).toBe(false);
  expect(mockPublicStatus).toHaveBeenCalledTimes(1);
});
