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
  markZcashBackendShieldedCounterparty,
  normalizeZcashBackendHistoryTx,
  restoreZcashLocalTransparentPayment,
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
    expect(tx.from).toBe('');
    expect(tx.shieldedCounterparty).toBe('from');
    expect(tx.sends).toHaveLength(1);
    expect(tx.sends[0].type).toBe(EOnChainHistoryTransferType.Shielded);
    expect(tx.sends[0]).toMatchObject({ address: '', label: '' });
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
    expect(tx.to).toBe('');
    expect(tx.shieldedCounterparty).toBe('to');
    expect(tx.receives.map((r) => r.type)).toEqual([
      EOnChainHistoryTransferType.Shielded,
    ]);
  });

  it('keeps the shielded source the indexer lists itself', () => {
    const backendShielded = {
      type: EOnChainHistoryTransferType.Shielded,
      label: 'Shielded',
      address: '',
      from: '',
      to: '',
      token: '',
      key: 'zec--0_',
      amount: '0.028312',
      isOwn: false,
    };
    const tx = normalizeZcashBackendHistoryTx({
      ...base,
      type: EOnChainHistoryTxType.Receive,
      sends: [backendShielded],
      receives: [],
    });
    expect(tx.shieldedCounterparty).toBe('from');
    expect(tx.sends).toEqual([backendShielded]);
  });

  it('keeps the shielded destination the indexer lists itself', () => {
    const backendShielded = {
      type: EOnChainHistoryTransferType.Shielded,
      label: 'Shielded',
      address: '',
      from: '',
      to: '',
      token: '',
      key: 'zec--0_',
      amount: '0.5',
      isOwn: false,
    };
    const tx = normalizeZcashBackendHistoryTx({
      ...base,
      type: EOnChainHistoryTxType.Send,
      from: 't1own',
      to: '',
      sends: [],
      receives: [backendShielded],
    });
    expect(tx.shieldedCounterparty).toBe('to');
    expect(tx.receives).toEqual([backendShielded]);
  });

  it('keeps an address the indexer did report on the shielded side', () => {
    const tx = normalizeZcashBackendHistoryTx({
      ...base,
      type: EOnChainHistoryTxType.Receive,
      from: 't1sender',
      sends: [],
      receives: [],
    });
    expect(tx.from).toBe('t1sender');
    expect(tx.shieldedCounterparty).toBeUndefined();
    expect(tx.sends).toEqual([]);
  });

  it('leaves a transparent receive from another t1 to show its sender', () => {
    // The indexer's receive row for a t1 -> t1 payment: no sends, sender in `from`.
    const row = {
      ...base,
      type: EOnChainHistoryTxType.Receive,
      from: 't1sender',
      to: 't1own',
      value: '0.00005',
      sends: [],
      receives: [
        {
          type: EOnChainHistoryTransferType.Transfer,
          from: 't1sender',
          to: 't1own',
          amount: '0.00005',
          token: '',
          key: 'zec--0_',
          label: '',
          isOwn: true,
        },
      ],
    };
    const tx = normalizeZcashBackendHistoryTx(row);
    expect(tx).toBe(row);
    expect(
      tx.sends.some(
        (send) => send.type === EOnChainHistoryTransferType.Shielded,
      ),
    ).toBe(false);
  });

  it('marks only the shielded side of the built action', () => {
    const builtRow = () =>
      ({
        decodedTx: {
          actions: [
            {
              assetTransfer: { from: '', to: 't1own', sends: [], receives: [] },
            },
          ],
        },
      }) as unknown as IAccountHistoryTx;
    const receive = builtRow();
    markZcashBackendShieldedCounterparty({
      onChainHistoryTx: { ...base, shieldedCounterparty: 'from' },
      historyTx: receive,
    });
    expect(receive.decodedTx.actions[0].assetTransfer).toEqual({
      from: '',
      to: 't1own',
      shieldedFrom: {},
      sends: [],
      receives: [],
    });
    const plain = builtRow();
    markZcashBackendShieldedCounterparty({
      onChainHistoryTx: base,
      historyTx: plain,
    });
    expect(plain).toEqual(builtRow());
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

  // Change returns to the sending t1, so the indexer row reads t1 -> t1.
  it.each([
    ['a shielded payment with change', '0.50015'],
    ['a true transfer to the same t1', '0.00015'],
  ])(
    'names the shielded counterparty of %s with the backend value',
    (_, value) => {
      const input = {
        ...base,
        type: EOnChainHistoryTxType.Send,
        from: 't1own',
        to: 't1own',
        value,
        sends: [
          {
            type: EOnChainHistoryTransferType.Transfer,
            from: 't1own',
            to: '',
            amount: value,
            token: '',
            key: 'zec--0_',
            label: '',
            isOwn: true,
          },
        ],
        receives: [],
      };
      const tx = normalizeZcashBackendHistoryTx(input);
      expect(tx).toMatchObject({
        from: 't1own',
        to: '',
        value,
        shieldedCounterparty: 'to',
      });
      expect(tx.receives).toEqual([
        expect.objectContaining({
          type: EOnChainHistoryTransferType.Shielded,
          to: '',
          amount: value,
          isOwn: false,
        }),
      ]);
      // Applied again on the same row, nothing more is added.
      expect(normalizeZcashBackendHistoryTx(tx)).toBe(tx);
    },
  );

  const ownChange = {
    type: EOnChainHistoryTransferType.Transfer,
    from: 't1own',
    to: 't1own',
    amount: '0.4',
    token: '',
    key: 'zec--0_',
    label: '',
    isOwn: true,
  };

  // An xpub row from another device lists our change back to t1 as ours.
  it('names the shielded counterparty when the row lists our change', () => {
    const tx = normalizeZcashBackendHistoryTx({
      ...base,
      type: EOnChainHistoryTxType.Send,
      from: 't1own',
      to: 't1own',
      value: '0.50015',
      sends: [],
      receives: [ownChange],
    });
    expect(tx).toMatchObject({
      to: '',
      value: '0.50015',
      shieldedCounterparty: 'to',
    });
    expect(tx.receives).toEqual([
      ownChange,
      expect.objectContaining({
        type: EOnChainHistoryTransferType.Shielded,
        amount: '0.50015',
        isOwn: false,
      }),
    ]);
  });

  it('keeps a payment to itself that this device signed', () => {
    const backendRow = {
      ...base,
      type: EOnChainHistoryTxType.Send,
      from: 't1own',
      to: 't1own',
      value: '0.00015',
      gasFee: '0.00015',
      sends: [],
      receives: [ownChange],
    };
    const localTx = {
      id: 'local',
      isLocalCreated: true,
      privacyChainHistorySide: 'public',
      decodedTx: {
        txid: base.tx,
        networkId: 'zec--0',
        owner: 't1own',
        signer: 't1own',
        encodedTx: {
          zcashMode: 'transparent',
          zcashTo: 't1own',
          zcashAmountValue: '50000000',
          fee: '15000',
        },
      },
    } as unknown as IAccountHistoryTx;
    const restored = restoreZcashLocalTransparentPayment({
      tx: normalizeZcashBackendHistoryTx(backendRow),
      localTx,
    });
    expect(normalizeZcashBackendHistoryTx(restored)).toBe(restored);
    expect(restored).toMatchObject({ to: 't1own', value: '0.5' });
    expect(restored.receives).toEqual([
      expect.objectContaining({ to: 't1own', amount: '0.5', isOwn: true }),
    ]);
  });
});
