/* eslint-disable import/first */
const mockStore = new Map<string, string>();
const mockSyncStorage = {
  getString: jest.fn((key: string) => mockStore.get(key)),
  set: jest.fn((key: string, value: string) => {
    mockStore.set(key, value);
  }),
};
let mockIsFreshInstall = false;
const mockPlatformEnv = { isExtension: false };

jest.mock('../storage/instance/syncStorageInstance', () => ({
  get syncStorage() {
    return mockSyncStorage;
  },
}));
jest.mock('./freshInstallDetector', () => ({
  isFreshInstallSync: () => mockIsFreshInstall,
}));
jest.mock('../platformEnv', () => ({
  __esModule: true,
  get default() {
    return mockPlatformEnv;
  },
}));

import { OneKeyLocalError } from '../errors';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import {
  readWalletPresenceHintSync,
  resetColdStartOnboardingDecisionForTest,
  shouldColdStartIntoOnboardingSync,
  writeWalletPresenceHint,
} from './walletPresenceHintUtils';

const KEY = EAppSyncStorageKeys.onekey_wallet_presence_hint;

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
  mockIsFreshInstall = false;
  mockPlatformEnv.isExtension = false;
  resetColdStartOnboardingDecisionForTest();
});

describe('wallet presence hint', () => {
  test('writes the hint from the wallet count and skips unchanged writes', () => {
    writeWalletPresenceHint({ hasWallet: false });
    expect(mockStore.get(KEY)).toBe('no_wallet');
    writeWalletPresenceHint({ hasWallet: false });
    expect(mockSyncStorage.set).toHaveBeenCalledTimes(1);
    writeWalletPresenceHint({ hasWallet: true });
    expect(mockStore.get(KEY)).toBe('has_wallet');
  });

  test('does not write in the extension', () => {
    mockPlatformEnv.isExtension = true;
    writeWalletPresenceHint({ hasWallet: false });
    expect(mockSyncStorage.set).not.toHaveBeenCalled();
  });

  test('treats unknown or unreadable values as no hint', () => {
    mockStore.set(KEY, 'garbage');
    expect(readWalletPresenceHintSync()).toBeUndefined();
    mockSyncStorage.getString.mockImplementationOnce(() => {
      throw new OneKeyLocalError('blocked');
    });
    expect(readWalletPresenceHintSync()).toBeUndefined();
  });
});

describe('shouldColdStartIntoOnboardingSync', () => {
  test('opens onboarding when bg recorded no wallet', () => {
    mockStore.set(KEY, 'no_wallet');
    expect(shouldColdStartIntoOnboardingSync()).toBe(true);
  });

  test('keeps Main when bg recorded a wallet, even on an empty store', () => {
    mockStore.set(KEY, 'has_wallet');
    mockIsFreshInstall = true;
    expect(shouldColdStartIntoOnboardingSync()).toBe(false);
  });

  test('without a hint, follows the fresh install detector', () => {
    mockIsFreshInstall = true;
    expect(shouldColdStartIntoOnboardingSync()).toBe(true);
    resetColdStartOnboardingDecisionForTest();
    mockIsFreshInstall = false;
    expect(shouldColdStartIntoOnboardingSync()).toBe(false);
  });

  test('decides once per cold start', () => {
    mockStore.set(KEY, 'no_wallet');
    expect(shouldColdStartIntoOnboardingSync()).toBe(true);
    mockStore.set(KEY, 'has_wallet');
    expect(shouldColdStartIntoOnboardingSync()).toBe(true);
  });
});
