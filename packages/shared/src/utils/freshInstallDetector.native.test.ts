import { OneKeyLocalError } from '../errors';

import {
  isFreshInstallSync,
  resetFirstLaunchState,
} from './freshInstallDetector.native';

const mockPlatform = { isNativeMainThread: true };
const mockIsMaskingDataSync = jest.fn(() => false);
const mockIsFirstLaunch = jest.fn(() => false);
const mockResetFirstLaunch = jest.fn(() => true);

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
jest.mock('@onekeyfe/react-native-device-utils/first-launch', () => ({
  isFirstLaunch: () => mockIsFirstLaunch(),
  resetFirstLaunch: () => mockResetFirstLaunch(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.isNativeMainThread = true;
  mockIsMaskingDataSync.mockReturnValue(false);
  mockIsFirstLaunch.mockReturnValue(false);
  mockResetFirstLaunch.mockReturnValue(true);
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

it('delegates resetFirstLaunchState to native resetFirstLaunch', () => {
  expect(resetFirstLaunchState()).toBe(true);
  mockResetFirstLaunch.mockReturnValue(false);
  expect(resetFirstLaunchState()).toBe(false);
  expect(mockResetFirstLaunch).toHaveBeenCalledTimes(2);
});
