import {
  getHomeLatestActiveAccountCacheGlobal,
  readHomeLatestActiveAccountCache,
  setHomeLatestActiveAccountCacheGlobal,
} from '@onekeyhq/shared/src/utils/homeLatestActiveAccountCache';

import {
  loadHomeStartupPreparedDisplaySnapshot,
  resetHomeStartupPreparedDisplaySnapshotForTest,
} from './homeStartupPreparedDisplaySnapshot.native';
import { loadPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.native';

import type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';

jest.mock('@onekeyhq/shared/src/utils/homeLatestActiveAccountCache', () => ({
  getHomeLatestActiveAccountCacheGlobal: jest.fn(),
  readHomeLatestActiveAccountCache: jest.fn(),
  setHomeLatestActiveAccountCacheGlobal: jest.fn(),
}));

jest.mock('./loadPreparedHomeDisplaySnapshot.native', () => ({
  loadPreparedHomeDisplaySnapshot: jest.fn(),
}));

const mockGetGlobal = jest.mocked(getHomeLatestActiveAccountCacheGlobal);
const mockRead = jest.mocked(readHomeLatestActiveAccountCache);
const mockSetGlobal = jest.mocked(setHomeLatestActiveAccountCacheGlobal);
const mockLoadPrepared = jest.mocked(loadPreparedHomeDisplaySnapshot);

const latestActiveAccount = {
  activeAccount: { ready: true },
  owner: {
    accountId: 'account-a',
    network: { kind: 'singleNetwork' as const, networkId: 'evm--1' },
    walletId: 'wallet-a',
  },
  ownerScopeKey: 'owner-a',
  updatedAt: 1,
  version: 1 as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  resetHomeStartupPreparedDisplaySnapshotForTest();
});

describe('homeStartupPreparedDisplaySnapshot native', () => {
  it('loads the exact owner partition once before authoritative owner readiness', () => {
    const displaySnapshot: IPreparedHomeDisplaySnapshot = {
      records: [],
    };
    mockGetGlobal.mockReturnValue(latestActiveAccount);
    mockLoadPrepared.mockReturnValue(displaySnapshot);

    expect(loadHomeStartupPreparedDisplaySnapshot()).toEqual({
      displaySnapshot,
      ownerScopeKey: 'owner-a',
    });
    expect(loadHomeStartupPreparedDisplaySnapshot()).toEqual({
      displaySnapshot,
      ownerScopeKey: 'owner-a',
    });
    expect(mockLoadPrepared).toHaveBeenCalledTimes(1);
    expect(mockLoadPrepared).toHaveBeenCalledWith({
      ownerScopeKey: 'owner-a',
    });
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('falls back to the independent MMKV record when entry pre-read is absent', () => {
    mockRead.mockReturnValue(latestActiveAccount);

    expect(loadHomeStartupPreparedDisplaySnapshot()?.ownerScopeKey).toBe(
      'owner-a',
    );
    expect(mockSetGlobal).toHaveBeenCalledWith(latestActiveAccount);
  });
});
