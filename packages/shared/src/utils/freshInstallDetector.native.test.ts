import { OneKeyLocalError } from '../errors';

import {
  initFirstLaunchForApp,
  isFreshInstallSync,
  resetFirstLaunchState,
} from './freshInstallDetector.native';

const mockPlatform = { isNativeMainThread: true, bundleVersion: '1048' };
const mockIsMaskingDataSync = jest.fn(() => false);
const mockInitFirstLaunch = jest.fn<void, unknown[]>();
const mockIsFirstLaunch = jest.fn(() => false);
const mockResetFirstLaunch = jest.fn(() => true);
const mockWriteFile = jest.fn<Promise<void>, unknown[]>(() =>
  Promise.resolve(),
);

jest.mock('../platformEnv', () => ({
  __esModule: true,
  get default() {
    return mockPlatform;
  },
}));
jest.mock('../travelMode', () => ({
  travelModeManager: {
    isMaskingDataSync: () => mockIsMaskingDataSync(),
  },
}));
jest.mock('../modules3rdParty/react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/mock/documents',
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  },
}));
jest.mock('@onekeyfe/react-native-device-utils/first-launch', () => ({
  initFirstLaunch: (...args: unknown[]) => mockInitFirstLaunch(...args),
  isFirstLaunch: () => mockIsFirstLaunch(),
  resetFirstLaunch: () => mockResetFirstLaunch(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.isNativeMainThread = true;
  mockIsMaskingDataSync.mockReturnValue(false);
  mockIsFirstLaunch.mockReturnValue(false);
  mockResetFirstLaunch.mockReturnValue(true);
  mockWriteFile.mockResolvedValue(undefined);
});

it('returns the native first-launch state on the main thread', () => {
  mockIsFirstLaunch.mockReturnValue(true);
  expect(isFreshInstallSync()).toBe(true);
  mockIsFirstLaunch.mockReturnValue(false);
  expect(isFreshInstallSync()).toBe(false);
});

it('returns false outside the native main thread', () => {
  mockPlatform.isNativeMainThread = false;
  mockIsFirstLaunch.mockReturnValue(true);
  expect(isFreshInstallSync()).toBe(false);
  expect(mockIsFirstLaunch).not.toHaveBeenCalled();
});

it('returns false when Travel Mode is masking data', () => {
  mockIsMaskingDataSync.mockReturnValue(true);
  mockIsFirstLaunch.mockReturnValue(true);
  expect(isFreshInstallSync()).toBe(false);
  expect(mockIsFirstLaunch).not.toHaveBeenCalled();
});

it('fails closed when the native getter throws', () => {
  mockIsFirstLaunch.mockImplementation(() => {
    throw new OneKeyLocalError('native error');
  });
  expect(isFreshInstallSync()).toBe(false);
});

it('does not throw during init when older native hosts lack first-launch methods', () => {
  mockInitFirstLaunch.mockImplementation(() => {
    throw new TypeError(
      'ReactNativeDeviceUtils.isFirstLaunch is not a function',
    );
  });
  expect(() => initFirstLaunchForApp()).not.toThrow();
});

it('delegates resetFirstLaunchState to native resetFirstLaunch and writes reset marker', async () => {
  await expect(resetFirstLaunchState()).resolves.toBe(true);
  expect(mockWriteFile).toHaveBeenCalledWith(
    '/mock/documents/.onekey_first_launch_reset',
    '1',
    'utf8',
  );
  mockResetFirstLaunch.mockReturnValue(false);
  await expect(resetFirstLaunchState()).resolves.toBe(false);
  expect(mockResetFirstLaunch).toHaveBeenCalledTimes(2);
});

it('succeeds on reset when older native hosts lack resetFirstLaunch', async () => {
  mockResetFirstLaunch.mockImplementation(() => {
    throw new TypeError(
      'ReactNativeDeviceUtils.resetFirstLaunch is not a function',
    );
  });
  await expect(resetFirstLaunchState()).resolves.toBe(true);
  expect(mockWriteFile).not.toHaveBeenCalled();
});
