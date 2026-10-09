/* eslint-disable max-classes-per-file -- Two mock classes model the bridge and API module. */
import { DESKTOP_API_MESSAGE_TYPE } from '../base/consts';

import desktopApi from './desktopApi';

import type { IDesktopApiMessagePayload } from '../base/types';

let mockReceive: (payload: {
  data: IDesktopApiMessagePayload;
}) => Promise<unknown>;
const mockPrivateInstall = jest.fn();
const mockPublicStatus = jest.fn(async () => false);

jest.mock('@onekeyhq/shared/src/utils/cacheUtils', () => ({
  memoizee: <T>(fn: T) => fn,
}));
jest.mock('@onekeyhq/shared/src/platformEnvLite', () => ({
  __esModule: true,
  default: { isDesktop: true },
}));
jest.mock('../base/JsBridgeDesktopApiOfMain', () => ({
  JsBridgeDesktopApiOfMain: class {
    constructor(config: { receiveHandler: typeof mockReceive }) {
      mockReceive = config.receiveHandler;
    }
  },
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

test('invoke and legacy receive share the generated public visibility gate', async () => {
  desktopApi.desktopApiSetup();
  expect(() =>
    desktopApi.callDesktopApiMethod(message('launchWindowsInstaller')),
  ).toThrow('not public');
  await expect(
    mockReceive({ data: message('launchWindowsInstaller') }),
  ).rejects.toThrow('not public');
  expect(() => desktopApi.callDesktopApiMethod(message('toString'))).toThrow(
    'not public',
  );
  expect(mockPrivateInstall).not.toHaveBeenCalled();
  expect(
    await desktopApi.callDesktopApiMethod(message('isDownloadingPackage')),
  ).toBe(false);
  expect(await mockReceive({ data: message('isDownloadingPackage') })).toBe(
    false,
  );
  expect(mockPublicStatus).toHaveBeenCalledTimes(2);
});
