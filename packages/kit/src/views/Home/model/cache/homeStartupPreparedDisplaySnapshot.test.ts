import {
  getHomeLatestActiveAccountCacheGlobal,
  readHomeLatestActiveAccountCache,
  setHomeLatestActiveAccountCacheGlobal,
} from '@onekeyhq/shared/src/utils/homeLatestActiveAccountCache';

import {
  loadHomeStartupPreparedDisplaySnapshot,
  prepareHomeDisplaySnapshot,
  resetHomeStartupPreparedDisplaySnapshotForTest,
} from './homeStartupPreparedDisplaySnapshot';
import { loadPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot';

jest.mock('@onekeyhq/shared/src/utils/homeLatestActiveAccountCache', () => ({
  getHomeLatestActiveAccountCacheGlobal: jest.fn(),
  readHomeLatestActiveAccountCache: jest.fn(),
  setHomeLatestActiveAccountCacheGlobal: jest.fn(),
}));

jest.mock('./loadPreparedHomeDisplaySnapshot', () => ({
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

describe('homeStartupPreparedDisplaySnapshot browser runtimes', () => {
  it('deduplicates an in-flight owner read and caches its settled result', async () => {
    mockLoadPrepared.mockResolvedValue({ records: [] });

    const first = prepareHomeDisplaySnapshot({ ownerScopeKey: 'owner-a' });
    const second = prepareHomeDisplaySnapshot({ ownerScopeKey: 'owner-a' });

    expect(first).toBe(second);
    expect(first.kind).toBe('pending');
    if (first.kind === 'pending') {
      await expect(first.task).resolves.toEqual({
        displaySnapshot: { records: [] },
        ownerScopeKey: 'owner-a',
      });
    }
    expect(mockLoadPrepared).toHaveBeenCalledTimes(1);
    expect(prepareHomeDisplaySnapshot({ ownerScopeKey: 'owner-a' })).toEqual({
      kind: 'ready',
      result: {
        displaySnapshot: { records: [] },
        ownerScopeKey: 'owner-a',
      },
    });
  });

  it('starts the cached owner partition after cold-start hydration', async () => {
    mockGetGlobal.mockReturnValue(latestActiveAccount);
    mockLoadPrepared.mockResolvedValue(undefined);

    const handle = loadHomeStartupPreparedDisplaySnapshot();
    expect(handle).toMatchObject({
      kind: 'pending',
      ownerScopeKey: 'owner-a',
    });
    if (handle?.kind === 'pending') {
      await handle.task;
    }
    expect(mockLoadPrepared).toHaveBeenCalledWith({
      ownerScopeKey: 'owner-a',
    });
    expect(mockRead).not.toHaveBeenCalled();
    expect(mockSetGlobal).toHaveBeenCalledWith(latestActiveAccount);
  });
});
