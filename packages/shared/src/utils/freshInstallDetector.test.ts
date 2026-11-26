/**
 * @jest-environment jsdom
 */

import {
  initFirstLaunchForApp,
  isFreshInstallSync,
  resetFirstLaunchState,
} from './freshInstallDetector';

const mockInitFirstLaunch = jest.fn<void, [unknown]>();
const mockResetFirstLaunch = jest.fn(() => true);

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    version: '6.8.0',
    bundleVersion: '1048',
  },
}));
jest.mock('@onekeyfe/react-native-device-utils/first-launch', () => ({
  initFirstLaunch: (options: unknown) => mockInitFirstLaunch(options),
  isFirstLaunch: jest.fn(() => false),
  isFirstLaunchForCurrentAppVersion: jest.fn(() => false),
  isFirstLaunchForCurrentBundle: jest.fn(() => false),
  resetFirstLaunch: () => mockResetFirstLaunch(),
}));

const runtime = globalThis as typeof globalThis & {
  __ONEKEY_LEGACY_INSTALL__?: boolean;
};

beforeEach(() => {
  jest.clearAllMocks();
  delete runtime.__ONEKEY_LEGACY_INSTALL__;
  mockResetFirstLaunch.mockReturnValue(true);
});

afterEach(() => {
  delete runtime.__ONEKEY_LEGACY_INSTALL__;
});

it('forwards appVersion, bundleVersion, and legacy flag from HTML preload', () => {
  runtime.__ONEKEY_LEGACY_INSTALL__ = true;
  initFirstLaunchForApp();
  expect(mockInitFirstLaunch).toHaveBeenCalledWith({
    appVersion: '6.8.0',
    bundleVersion: '1048',
    isLegacyInstall: true,
  });
});

it('defaults isLegacyInstall to false when HTML preload flag is absent', () => {
  initFirstLaunchForApp();
  expect(mockInitFirstLaunch).toHaveBeenCalledWith({
    appVersion: '6.8.0',
    bundleVersion: '1048',
    isLegacyInstall: false,
  });
});

it('keeps isFreshInstallSync false on non-native platforms and delegates reset', () => {
  expect(isFreshInstallSync()).toBe(false);
  expect(resetFirstLaunchState()).toBe(true);
  expect(mockResetFirstLaunch).toHaveBeenCalledTimes(1);
});
