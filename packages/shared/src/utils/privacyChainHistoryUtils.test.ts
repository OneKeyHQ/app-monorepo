import { EDecodedTxStatus } from '../../types/tx';

import {
  appendMissingPrivacyChainHistoryTxs,
  isPrivacyChainHistoryComplete,
  isPrivacyChainHistoryVisible,
  mergePrivacyChainHistoryTxs,
  projectPrivacyChainHistoryTxToPool,
} from './privacyChainHistoryUtils';

import type {
  IAccountHistoryTx,
  IPrivacyChainHistorySide,
} from '../../types/history';

type ITestTx = {
  source: 'private' | 'public';
  decodedTx: { txid: string };
  privacyChainHistoryPoolIds?: number[];
  privacyChainHistorySide?: IPrivacyChainHistorySide;
  privacyChainHistoryPoolDeltas?: Record<string, string>;
};

const tx = (txid: string, source: 'private' | 'public'): ITestTx => ({
  source,
  decodedTx: { txid },
});

describe('isPrivacyChainHistoryVisible', () => {
  it('keeps exact future pool IDs distinct', () => {
    expect(
      isPrivacyChainHistoryVisible({
        txPoolIds: [4, 99],
        selectedPoolId: 99,
      }),
    ).toBe(true);
    expect(
      isPrivacyChainHistoryVisible({
        txPoolIds: [4, 99],
        selectedPoolId: 3,
      }),
    ).toBe(false);
  });

  it('aggregates exact pools only for the current public/private view', () => {
    expect(
      isPrivacyChainHistoryVisible({
        txPoolIds: [0, 4, 99],
        selectedSide: 'public',
      }),
    ).toBe(true);
    expect(
      isPrivacyChainHistoryVisible({
        txPoolIds: [0, 4, 99],
        selectedSide: 'private',
      }),
    ).toBe(true);
  });

  it('shows mixed transactions on both sides', () => {
    expect(
      isPrivacyChainHistoryVisible({ txSide: 'mixed', selectedSide: 'public' }),
    ).toBe(true);
    expect(
      isPrivacyChainHistoryVisible({
        txSide: 'mixed',
        selectedSide: 'private',
      }),
    ).toBe(true);
  });

  it('keeps public and private rows on their own side', () => {
    expect(
      isPrivacyChainHistoryVisible({
        txSide: 'public',
        selectedSide: 'public',
      }),
    ).toBe(true);
    expect(
      isPrivacyChainHistoryVisible({
        txSide: 'public',
        selectedSide: 'private',
      }),
    ).toBe(false);
  });

  it('does not hide legacy rows without a side marker', () => {
    expect(isPrivacyChainHistoryVisible({ selectedSide: 'private' })).toBe(
      true,
    );
  });

  it('does not put a row with unknown pools into every exact pool tab', () => {
    expect(
      isPrivacyChainHistoryVisible({
        txPoolIds: [],
        selectedPoolId: 3,
      }),
    ).toBe(false);
  });
});

describe('projectPrivacyChainHistoryTxToPool', () => {
  const historyTx = {
    id: 'history-a',
    privacyChainHistoryPoolDeltas: {
      '0': '-2.5',
      '4': '2',
      '99': '0',
    },
    decodedTx: {
      txid: 'a',
      nativeAmount: '0.6',
      nativeAmountIsUnknown: true,
      actions: [
        {
          assetTransfer: {
            sends: [{ amount: '0.6', symbol: 'ZEC' }],
            receives: [],
          },
        },
      ],
    },
  } as unknown as IAccountHistoryTx;

  it.each([
    [0, '2.5', 1, 0],
    [4, '2', 0, 1],
    [99, '0', 1, 0],
  ] as const)(
    'projects signed pool %s without dropping a zero delta',
    (poolId, amount, sendCount, receiveCount) => {
      const projected = projectPrivacyChainHistoryTxToPool({
        tx: historyTx,
        selectedPoolId: poolId,
      });
      const transfer = projected.decodedTx.actions[0].assetTransfer;
      expect(projected.decodedTx.nativeAmount).toBe(amount);
      expect(projected.decodedTx.nativeAmountIsUnknown).toBe(false);
      expect(transfer?.sends).toHaveLength(sendCount);
      expect(transfer?.receives).toHaveLength(receiveCount);
      expect((transfer?.sends[0] ?? transfer?.receives[0])?.amount).toBe(
        amount,
      );
    },
  );

  it('does not mutate the aggregate cached row', () => {
    projectPrivacyChainHistoryTxToPool({ tx: historyTx, selectedPoolId: 4 });
    expect(historyTx.decodedTx.nativeAmount).toBe('0.6');
    expect(historyTx.decodedTx.actions[0].assetTransfer?.sends[0].amount).toBe(
      '0.6',
    );
  });
});

describe('mergePrivacyChainHistoryTxs', () => {
  it('lets the indexer win a collision: the transparent leg is backend-only', () => {
    const merged = mergePrivacyChainHistoryTxs({
      privateTxs: [
        {
          ...tx('a', 'private'),
          privacyChainHistoryPoolIds: [0, 4],
          privacyChainHistoryPoolDeltas: { '0': '1', '4': '-1.0001' },
        },
      ],
      publicTxs: [
        {
          ...tx('a', 'public'),
          privacyChainHistoryPoolIds: [0],
          privacyChainHistorySide: 'public' as const,
        },
      ],
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      source: 'public',
      privacyChainHistoryPoolIds: [0, 4],
      privacyChainHistorySide: 'mixed',
      privacyChainHistoryPoolDeltas: { '0': '1', '4': '-1.0001' },
    });
  });

  it('adds local shielded rows the indexer cannot see', () => {
    const merged = mergePrivacyChainHistoryTxs({
      privateTxs: [{ ...tx('a', 'private'), privacyChainHistoryPoolIds: [4] }],
      publicTxs: [tx('b', 'public')],
    });
    expect(merged.map((t) => t.decodedTx.txid)).toEqual(['b', 'a']);
    expect(merged[1].privacyChainHistorySide).toBe('private');
  });

  it('never lets the local scan represent a transparent leg', () => {
    const merged = mergePrivacyChainHistoryTxs({
      privateTxs: [
        {
          ...tx('a', 'private'),
          privacyChainHistoryPoolIds: [0, 4],
          privacyChainHistoryPoolDeltas: { '0': '-1', '4': '0.9999' },
        },
        { ...tx('b', 'private'), privacyChainHistoryPoolIds: [0] },
      ],
      publicTxs: [],
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      decodedTx: { txid: 'a' },
      privacyChainHistoryPoolIds: [4],
      privacyChainHistorySide: 'private',
      privacyChainHistoryPoolDeltas: { '4': '0.9999' },
    });
  });

  it('carries the public half alone before the scan has found anything', () => {
    const merged = mergePrivacyChainHistoryTxs({
      privateTxs: [],
      publicTxs: [tx('a', 'public'), tx('b', 'public')],
    });
    expect(merged.map((t) => t.decodedTx.txid)).toEqual(['a', 'b']);
  });

  it('does not duplicate a txid the public half reports twice', () => {
    const merged = mergePrivacyChainHistoryTxs({
      privateTxs: [{ ...tx('a', 'private'), privacyChainHistoryPoolIds: [4] }],
      publicTxs: [tx('a', 'public'), tx('a', 'public')],
    });
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('public');
  });

  it('deduplicates by txid even when cache ids differ', () => {
    const merged = mergePrivacyChainHistoryTxs({
      privateTxs: [
        {
          id: 'runtime-id',
          source: 'private',
          decodedTx: { txid: 'a' },
          privacyChainHistoryPoolIds: [4],
        },
      ],
      publicTxs: [
        { id: 'backend-id$key', source: 'public', decodedTx: { txid: 'a' } },
      ],
    });
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('backend-id$key');
  });
});

describe('projectPrivacyChainHistoryTxToPool fee handling', () => {
  it('shows the transferred amount on the paying pool, fee excluded', () => {
    const sent = {
      id: 's',
      privacyChainHistoryPoolIds: [4],
      privacyChainHistoryPoolDeltas: { '4': '-0.0501' },
      decodedTx: {
        txid: 's',
        owner: 't1own',
        totalFeeInNative: '0.0001',
        nativeAmount: '0.05',
        actions: [
          {
            assetTransfer: {
              from: 't1own',
              to: 'u1recipient',
              sends: [{ from: 't1own', to: 'u1recipient', amount: '0.05' }],
              receives: [],
            },
          },
        ],
      },
    } as unknown as IAccountHistoryTx;
    const projected = projectPrivacyChainHistoryTxToPool({
      tx: sent,
      selectedPoolId: 4,
    });
    expect(projected.decodedTx.nativeAmount).toBe('0.05');
    expect(projected.decodedTx.actions[0].assetTransfer?.sends[0].amount).toBe(
      '0.05',
    );
  });
});

describe('projectPrivacyChainHistoryTxToPool on an indexer-backed mixed row', () => {
  const withdraw = {
    id: 'w',
    privacyChainHistoryPoolIds: [0, 4],
    privacyChainHistorySide: 'mixed',
    privacyChainHistoryPoolDeltas: { '0': '0.028112', '4': '-0.028212' },
    decodedTx: {
      txid: 'w',
      owner: 't1own',
      nativeAmount: '0.028112',
      actions: [
        {
          assetTransfer: {
            from: 'Shielded',
            to: 't1own',
            sends: [{ from: 'Shielded', to: '', amount: '0.028112' }],
            receives: [{ from: '', to: 't1own', amount: '0.028112' }],
          },
        },
      ],
    },
  } as unknown as IAccountHistoryTx;

  it('shows the shielded side of a withdraw as a send to the own address', () => {
    const projected = projectPrivacyChainHistoryTxToPool({
      tx: withdraw,
      selectedPoolId: 4,
    });
    const transfer = projected.decodedTx.actions[0].assetTransfer;
    expect(transfer?.sends).toEqual([
      expect.objectContaining({
        from: 't1own',
        to: 't1own',
        amount: '0.028212',
      }),
    ]);
    expect(transfer?.receives).toEqual([]);
  });

  it('leaves the public side as the indexer described it', () => {
    const projected = projectPrivacyChainHistoryTxToPool({
      tx: withdraw,
      selectedPoolId: 0,
    });
    const transfer = projected.decodedTx.actions[0].assetTransfer;
    expect(transfer?.receives).toEqual([
      expect.objectContaining({ from: '', to: 't1own', amount: '0.028112' }),
    ]);
  });
});

describe('appendMissingPrivacyChainHistoryTxs', () => {
  it('does not restore stale pool metadata for a current txid', () => {
    const current = {
      source: 'current',
      decodedTx: { txid: 'a' },
      privacyChainHistoryPoolIds: [4],
      privacyChainHistorySide: 'private' as const,
    };
    const cached = {
      source: 'cached',
      decodedTx: { txid: 'a' },
      privacyChainHistoryPoolIds: [3],
      privacyChainHistorySide: 'private' as const,
    };

    expect(
      appendMissingPrivacyChainHistoryTxs({
        currentTxs: [current],
        cachedTxs: [cached],
      }),
    ).toEqual([current]);
  });

  it('does not restore a cached terminal status after a current reorg', () => {
    const current = {
      source: 'current',
      decodedTx: { txid: 'a', status: EDecodedTxStatus.Pending },
    };
    const cached = {
      source: 'cached',
      decodedTx: { txid: 'a', status: EDecodedTxStatus.Confirmed },
    };

    expect(
      appendMissingPrivacyChainHistoryTxs({
        currentTxs: [current],
        cachedTxs: [cached],
      }),
    ).toEqual([current]);
  });

  it('keeps cache-only rows while the current snapshot is incomplete', () => {
    expect(
      appendMissingPrivacyChainHistoryTxs({
        currentTxs: [tx('a', 'private')],
        cachedTxs: [tx('b', 'public')],
      }).map((item) => item.decodedTx.txid),
    ).toEqual(['a', 'b']);
  });
});

describe('isPrivacyChainHistoryComplete', () => {
  it('is complete only when both halves answered', () => {
    expect(
      isPrivacyChainHistoryComplete({
        privateSideComplete: true,
        publicSideFailed: false,
      }),
    ).toBe(true);
  });

  it('is incomplete while the local scan is still backfilling', () => {
    expect(
      isPrivacyChainHistoryComplete({
        privateSideComplete: false,
        publicSideFailed: false,
      }),
    ).toBe(false);
  });

  it('is incomplete when the indexer failed, so nothing gets deleted', () => {
    expect(
      isPrivacyChainHistoryComplete({
        privateSideComplete: true,
        publicSideFailed: true,
      }),
    ).toBe(false);
  });
});
