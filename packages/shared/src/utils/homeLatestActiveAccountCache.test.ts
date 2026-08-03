import { coldStartCacheStorage } from '../storage/instance/syncStorageInstance';

import {
  clearHomeLatestActiveAccountCache,
  createHomeLatestActiveAccountCache,
  parseHomeLatestActiveAccountCache,
  readHomeLatestActiveAccountCache,
  writeHomeLatestActiveAccountCache,
} from './homeLatestActiveAccountCache';

jest.mock('../storage/instance/syncStorageInstance', () => ({
  coldStartCacheStorage: {
    delete: jest.fn(),
    getObject: jest.fn(),
    setObject: jest.fn(),
  },
}));

const mockStorage = jest.mocked(coldStartCacheStorage);

const owner = {
  accountId: 'account-a',
  network: { kind: 'singleNetwork' as const, networkId: 'evm--1' },
  walletId: 'wallet-a',
};

beforeEach(() => {
  jest.clearAllMocks();
  clearHomeLatestActiveAccountCache();
});

describe('homeLatestActiveAccountCache', () => {
  it('round-trips an independently validated owner and display seed', () => {
    const cache = createHomeLatestActiveAccountCache({
      activeAccount: {
        account: { id: 'account-a' },
        network: { id: 'evm--1' },
        ready: true,
        wallet: { id: 'wallet-a' },
      },
      owner,
      updatedAt: 10,
    });

    writeHomeLatestActiveAccountCache(cache);
    expect(mockStorage.setObject.mock.calls).toContainEqual([
      'onekey_home_latest_active_account',
      cache,
    ]);

    mockStorage.getObject.mockReturnValue(cache);
    expect(readHomeLatestActiveAccountCache()).toEqual(cache);
  });

  it('rejects a record whose owner scope does not match its owner fields', () => {
    const cache = createHomeLatestActiveAccountCache({
      activeAccount: { ready: true },
      owner,
      updatedAt: 10,
    });

    expect(
      parseHomeLatestActiveAccountCache({
        ...cache,
        ownerScopeKey: 'home-owner|stale',
      }),
    ).toBeUndefined();
  });
});
