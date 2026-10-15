import { isPrivacyChainHistoryVisible } from '@onekeyhq/shared/src/utils/privacyChainHistoryUtils';
import {
  EOnChainHistoryTransferType,
  EOnChainHistoryTxStatus,
  EOnChainHistoryTxType,
} from '@onekeyhq/shared/types/history';
import type {
  IAccountHistoryTx,
  IFetchAccountHistoryResp,
  IOnChainHistoryTx,
} from '@onekeyhq/shared/types/history';

import {
  fetchCompleteZcashBackendHistory,
  normalizeZcashBackendHistoryTx,
} from './backendHistory';

function page(
  txids: string[],
  params?: { hasMore?: boolean; next?: string },
): IFetchAccountHistoryResp {
  return {
    data: txids.map((tx) => ({ tx }) as IOnChainHistoryTx),
    tokens: {},
    nfts: {},
    hasMore: params?.hasMore,
    next: params?.next,
  };
}

function built(txid: string): IAccountHistoryTx {
  return {
    id: txid,
    decodedTx: { txid },
  } as IAccountHistoryTx;
}

function publicBuilt(txid: string): IAccountHistoryTx {
  return {
    ...built(txid),
    privacyChainHistoryPoolIds: [0],
    privacyChainHistorySide: 'public',
  };
}

describe('fetchCompleteZcashBackendHistory', () => {
  it('follows indexer timestamp cursors until the public snapshot is complete', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page(['a'], { hasMore: true, next: '1000' }))
      .mockResolvedValueOnce(page(['b']));

    await expect(
      fetchCompleteZcashBackendHistory({
        fetchPage,
        buildPage: async ({ page: responsePage }) =>
          responsePage.data.map((tx) => built(tx.tx)),
      }),
    ).resolves.toEqual({
      txs: [publicBuilt('a'), publicBuilt('b')],
      snapshotComplete: true,
    });
    expect(fetchPage).toHaveBeenNthCalledWith(1, {
      limit: 500,
      maxTimestampMs: undefined,
    });
    expect(fetchPage).toHaveBeenNthCalledWith(2, {
      limit: 500,
      maxTimestampMs: 1000,
    });
  });

  it('does not claim completeness when the backend repeats a cursor', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page(['a'], { hasMore: true, next: '1000' }))
      .mockResolvedValueOnce(page(['b'], { hasMore: true, next: '1000' }));

    await expect(
      fetchCompleteZcashBackendHistory({
        fetchPage,
        buildPage: async ({ page: responsePage }) =>
          responsePage.data.map((tx) => built(tx.tx)),
      }),
    ).resolves.toEqual({
      txs: [publicBuilt('a'), publicBuilt('b')],
      snapshotComplete: false,
    });
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('stops an indexer cursor that moves toward newer history', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page(['a'], { hasMore: true, next: '1000' }))
      .mockResolvedValueOnce(page(['b'], { hasMore: true, next: '2000' }));

    await expect(
      fetchCompleteZcashBackendHistory({
        fetchPage,
        buildPage: async ({ page: responsePage }) =>
          responsePage.data.map((tx) => built(tx.tx)),
      }),
    ).resolves.toEqual({
      txs: [publicBuilt('a'), publicBuilt('b')],
      snapshotComplete: false,
    });
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('caps an oversized snapshot without treating it as authoritative', async () => {
    const fetchPage = jest.fn().mockResolvedValue(
      page(['a', 'b', 'c'], {
        hasMore: true,
        next: '999',
      }),
    );

    await expect(
      fetchCompleteZcashBackendHistory({
        maxItems: 2,
        pageSize: 2,
        fetchPage,
        buildPage: async ({ page: responsePage }) =>
          responsePage.data.map((tx) => built(tx.tx)),
      }),
    ).resolves.toEqual({
      txs: [publicBuilt('a'), publicBuilt('b')],
      snapshotComplete: false,
    });
  });

  it('does not trust an oversized final page', async () => {
    const fetchPage = jest.fn().mockResolvedValue(page(['a', 'b', 'c']));

    await expect(
      fetchCompleteZcashBackendHistory({
        maxItems: 2,
        pageSize: 2,
        fetchPage,
        buildPage: async ({ page: responsePage }) =>
          responsePage.data.map((tx) => built(tx.tx)),
      }),
    ).resolves.toEqual({
      txs: [publicBuilt('a'), publicBuilt('b')],
      snapshotComplete: false,
    });
  });

  it('stops on an empty page that incorrectly claims more data', async () => {
    const fetchPage = jest.fn().mockResolvedValue(
      page([], {
        hasMore: true,
        next: '999',
      }),
    );

    await expect(
      fetchCompleteZcashBackendHistory({
        fetchPage,
        buildPage: async () => [],
      }),
    ).resolves.toEqual({ txs: [], snapshotComplete: false });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('marks backend rows as transparent before the local scan catches up', async () => {
    const result = await fetchCompleteZcashBackendHistory({
      fetchPage: async () => page(['transparent-only']),
      buildPage: async ({ page: responsePage }) =>
        responsePage.data.map((tx) => built(tx.tx)),
    });

    expect(result.txs[0]).toMatchObject({
      privacyChainHistoryPoolIds: [0],
      privacyChainHistorySide: 'public',
    });
    expect(
      isPrivacyChainHistoryVisible({
        txPoolIds: result.txs[0].privacyChainHistoryPoolIds,
        txSide: result.txs[0].privacyChainHistorySide,
        selectedPoolId: 0,
      }),
    ).toBe(true);
    expect(
      isPrivacyChainHistoryVisible({
        txPoolIds: result.txs[0].privacyChainHistoryPoolIds,
        txSide: result.txs[0].privacyChainHistorySide,
        selectedPoolId: 3,
      }),
    ).toBe(false);
  });

  it('does not claim completeness when any backend row fails to decode', async () => {
    await expect(
      fetchCompleteZcashBackendHistory({
        fetchPage: async () => page(['good', 'bad']),
        buildPage: async () => [built('good'), null],
      }),
    ).resolves.toEqual({
      txs: [publicBuilt('good')],
      snapshotComplete: false,
    });
  });

  it('caps pagination by raw backend rows even when rows fail to decode', async () => {
    const fetchPage = jest.fn().mockResolvedValue(
      page(['bad-1', 'bad-2'], {
        hasMore: true,
        next: '999',
      }),
    );

    await expect(
      fetchCompleteZcashBackendHistory({
        maxItems: 2,
        pageSize: 2,
        fetchPage,
        buildPage: async () => [null, null],
      }),
    ).resolves.toEqual({ txs: [], snapshotComplete: false });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

describe('normalizeZcashBackendHistoryTx', () => {
  const base = {
    tx: '33bf50168e38f8d0ccd2f2184c8de61329e5ead18c68dcd0f36c03ca707b4daf',
    riskLevel: 0,
    label: '',
    from: '',
    to: 't1own',
    status: EOnChainHistoryTxStatus.Success,
    block: 3_460_992,
    timestamp: 1_787_722_799,
    confirmations: 13_980,
    value: '0.028112',
    networkId: 'zec--0',
    key: 'k',
  } as unknown as IOnChainHistoryTx;

  it('names the shielded source of a transparent receive', () => {
    const tx = normalizeZcashBackendHistoryTx({
      ...base,
      type: EOnChainHistoryTxType.Receive,
      sends: [],
      receives: [
        {
          type: EOnChainHistoryTransferType.Transfer,
          from: '',
          to: 't1own',
          amount: '0.028112',
          token: '',
          key: 'zec--0_',
          label: '',
          isOwn: true,
        },
      ],
    });
    expect(tx.from).toBe('Shielded');
    expect(tx.sends).toHaveLength(1);
    expect(tx.sends[0].type).toBe(EOnChainHistoryTransferType.Shielded);
    expect(tx.sends[0].amount).toBe('0.028112');
    expect(tx.receives).toHaveLength(1);
  });

  it('names the shielded destination of a transparent send with no external output', () => {
    const tx = normalizeZcashBackendHistoryTx({
      ...base,
      type: EOnChainHistoryTxType.Send,
      from: 't1own',
      to: '',
      sends: [
        {
          type: EOnChainHistoryTransferType.Transfer,
          from: 't1own',
          to: '',
          amount: '0.5',
          token: '',
          key: 'zec--0_',
          label: '',
          isOwn: true,
        },
      ],
      receives: [],
    });
    expect(tx.to).toBe('Shielded');
    expect(tx.receives.map((r) => r.type)).toEqual([
      EOnChainHistoryTransferType.Shielded,
    ]);
  });

  it('leaves an ordinary transparent transfer alone', () => {
    const input = {
      ...base,
      type: EOnChainHistoryTxType.Receive,
      from: 't1other',
      sends: [
        {
          type: EOnChainHistoryTransferType.Transfer,
          from: 't1other',
          to: '',
          amount: '1',
          token: '',
          key: 'zec--0_',
          label: '',
          isOwn: false,
        },
      ],
      receives: [],
    };
    expect(normalizeZcashBackendHistoryTx(input)).toBe(input);
  });
});
