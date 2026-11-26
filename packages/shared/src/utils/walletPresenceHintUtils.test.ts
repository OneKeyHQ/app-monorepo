/* eslint-disable import/first */
const mockStore = new Map<string, string>();
const mockSyncStorage = {
  getString: jest.fn((key: string) => mockStore.get(key)),
  set: jest.fn((key: string, value: string) => {
    mockStore.set(key, value);
  }),
};
const mockPlatformEnv = { isNativeBackgroundThread: true };

jest.mock('../storage/instance/syncStorageInstance', () => ({
  get syncStorage() {
    return mockSyncStorage;
  },
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
  writeWalletPresenceHint,
} from './walletPresenceHintUtils';

const KEY = EAppSyncStorageKeys.onekey_wallet_presence_hint;

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
  mockPlatformEnv.isNativeBackgroundThread = true;
});

describe('wallet presence hint', () => {
  test('writes the hint from the wallet count and skips unchanged writes', () => {
    writeWalletPresenceHint(false);
    expect(mockStore.get(KEY)).toBe('no_wallet');
    writeWalletPresenceHint(false);
    expect(mockSyncStorage.set).toHaveBeenCalledTimes(1);
    writeWalletPresenceHint(true);
    expect(mockStore.get(KEY)).toBe('has_wallet');
  });

  test('only writes in native bg', () => {
    mockPlatformEnv.isNativeBackgroundThread = false;
    writeWalletPresenceHint(false);
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

test('an in-progress wallet mutation makes the hint explicitly unknown', () => {
  writeWalletPresenceHint(false);
  writeWalletPresenceHint(undefined);
  expect(readWalletPresenceHintSync()).toBe('unknown');
  writeWalletPresenceHint(true);
  expect(readWalletPresenceHintSync()).toBe('has_wallet');
});
