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

  it('shows a receive that lists no sender as the backend wrote it', () => {
    const row = {
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
    };
    expect(normalizeZcashBackendHistoryTx(row)).toBe(row);
  });

  it('does not infer a shielded sender when a sparse receive names a public sender', () => {
    const row = {
      ...base,
      type: EOnChainHistoryTxType.Receive,
      sends: [],
      receives: [
        {
          type: EOnChainHistoryTransferType.Transfer,
          from: 't1sender',
          to: 't1own',
          amount: '1',
          token: '',
          key: 'zec--0_',
          label: '',
          isOwn: true,
        },
      ],
    };
    expect(normalizeZcashBackendHistoryTx(row)).toBe(row);
  });

  it('keeps an omitted destination unknown without private output evidence', () => {
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
    expect(tx.shieldedCounterparty).toBeUndefined();
    expect(tx.receives).toEqual([]);
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

  it.each(['t1recipient', 't1own', ''])(
    'does not invent a shielded recipient when %s has no receive details',
    (to) => {
      const input = {
        ...base,
        type: EOnChainHistoryTxType.Send,
        from: 't1own',
        to,
        value: '0.00000162',
        gasFee: '0.00000226',
        sends: [
          {
            type: EOnChainHistoryTransferType.Transfer,
            from: 't1own',
            to,
            amount: '0.00000162',
            token: '',
            key: 'zec--0_',
            label: '',
            isOwn: true,
          },
        ],
        receives: [],
      };
      expect(normalizeZcashBackendHistoryTx(input)).toBe(input);
    },
  );

  it.each(['t1recipient', 't1own', ''])(
    'does not treat owned transparent outputs as proof of a shielded payment to %s',
    (to) => {
      const input = {
        ...base,
        type: EOnChainHistoryTxType.Send,
        from: 't1own',
        to,
        value: '0.00000162',
        gasFee: '0.00000226',
        sends: [],
        receives: [
          {
            type: EOnChainHistoryTransferType.Transfer,
            from: 't1own',
            to: 't1own',
            amount: '0.4',
            token: '',
            key: 'zec--0_',
            label: '',
            isOwn: true,
          },
        ],
      };
      expect(normalizeZcashBackendHistoryTx(input)).toBe(input);
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
    isChange: true,
  };

  const privateOutput = {
    ...ownChange,
    type: EOnChainHistoryTransferType.Shielded,
    from: '',
    to: '',
    amount: '0.5',
    isOwn: false,
    isChange: false,
  };

  it('uses an explicit private output to distinguish a payment from public change', () => {
    const input = {
      ...base,
      type: EOnChainHistoryTxType.Send,
      from: 't1own',
      to: 't1own',
      value: '0.50015',
      gasFee: '0.00015',
      sends: [],
      receives: [ownChange, privateOutput],
    };
    const tx = normalizeZcashBackendHistoryTx(input);
    expect(tx).toEqual({ ...input, to: '', shieldedCounterparty: 'to' });
    expect(tx.receives).toBe(input.receives);
    expect(normalizeZcashBackendHistoryTx(tx)).toBe(tx);
  });

  it.each(['t1recipient', ''])(
    'keeps both destinations of a mixed public/private payment with top-level to=%s',
    (to) => {
      const input = {
        ...base,
        type: EOnChainHistoryTxType.Send,
        from: 't1own',
        to,
        value: '0.60015',
        gasFee: '0.00015',
        sends: [],
        receives: [
          {
            ...ownChange,
            to: 't1recipient',
            amount: '0.1',
            isOwn: false,
            isChange: false,
          },
          privateOutput,
        ],
      };
      expect(normalizeZcashBackendHistoryTx(input)).toBe(input);
    },
  );

  it.each([false, undefined])(
    'keeps an owned public output with isChange=%s alongside a private payment',
    (isChange) => {
      const input = {
        ...base,
        type: EOnChainHistoryTxType.Send,
        from: 't1own',
        to: 't1own',
        sends: [],
        receives: [
          ownChange,
          { ...ownChange, to: 't1secondaryown', isChange },
          privateOutput,
        ],
      };
      const normalized = normalizeZcashBackendHistoryTx(input);
      expect(normalized).toEqual({ ...input, to: '' });
      expect(normalized.receives).toBe(input.receives);
    },
  );

  it('does not erase a known public endpoint when only private output details are available', () => {
    const input = {
      ...base,
      type: EOnChainHistoryTxType.Send,
      from: 't1own',
      to: 't1own',
      sends: [],
      receives: [privateOutput],
    };
    expect(normalizeZcashBackendHistoryTx(input)).toBe(input);
  });

  it.each([undefined, true])(
    'does not use an owned private output with isChange=%s to infer a recipient',
    (isChange) => {
      const input = {
        ...base,
        type: EOnChainHistoryTxType.Send,
        from: 't1own',
        to: 't1own',
        sends: [],
        receives: [ownChange, { ...privateOutput, isOwn: true, isChange }],
      };
      const normalized = normalizeZcashBackendHistoryTx(input);
      expect(normalized).toEqual({ ...input, to: '' });
      expect(normalized.receives).toBe(input.receives);
    },
  );

  it('preserves an explicit payment to the same address as public change', () => {
    const input = {
      ...base,
      type: EOnChainHistoryTxType.Send,
      from: 't1own',
      to: 't1own',
      sends: [],
      receives: [ownChange, { ...ownChange, isChange: false }, privateOutput],
    };
    expect(normalizeZcashBackendHistoryTx(input)).toBe(input);
  });

  it('recognizes an explicitly identified non-change private payment to this wallet', () => {
    const input = {
      ...base,
      type: EOnChainHistoryTxType.Send,
      from: 't1own',
      to: 't1own',
      sends: [],
      receives: [ownChange, { ...privateOutput, isOwn: true, isChange: false }],
    };
    expect(normalizeZcashBackendHistoryTx(input)).toEqual({
      ...input,
      to: '',
      shieldedCounterparty: 'to',
    });
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
