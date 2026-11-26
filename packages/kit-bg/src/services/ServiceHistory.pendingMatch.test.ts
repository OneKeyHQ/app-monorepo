/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');

import { getSwapHistoryDisplayToAmount } from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  ESwapTxHistoryStatus,
  type ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EDecodedTxStatus,
  EDecodedTxActionType,
} from '@onekeyhq/shared/types/tx';

const ServiceHistory = require('./ServiceHistory')
  .default as typeof import('./ServiceHistory').default;

function tx(status: EDecodedTxStatus): IAccountHistoryTx {
  return {
    id: 'btc--0_addr_txid-1',
    decodedTx: {
      txid: 'txid-1',
      accountId: 'acc',
      networkId: 'btc--0',
      status,
      actions: [],
    },
  } as unknown as IAccountHistoryTx;
}

function localTx(): IAccountHistoryTx {
  const pending = tx(EDecodedTxStatus.Pending);
  return {
    ...pending,
    isLocalCreated: true,
    decodedTx: { ...pending.decodedTx, encodedTx: {} },
  } as unknown as IAccountHistoryTx;
}

describe('ServiceHistory local pending reconciliation', () => {
  function createService() {
    const batchUpdateLocalHistoryTxs = jest.fn(async () => undefined);
    const service = new ServiceHistory({
      backgroundApi: {
        serviceNetwork: { getVaultSettings: async () => ({}) },
        simpleDb: { localHistory: { batchUpdateLocalHistoryTxs } },
      },
    });
    return { service, batchUpdateLocalHistoryTxs };
  }

  it.each([
    ['same-chain receipt', 'fill', undefined, 'receiver', '2', '80'],
    ['cross-chain receipt', 'bridge', 'bridge', 'receiver', '2', '80'],
    ['unrelated transaction', 'other', undefined, 'receiver', '16', '10'],
    [
      'another recipient in the same transaction',
      'fill',
      undefined,
      'other',
      '16',
      '10',
    ],
  ] as const)(
    'decodes a %s against the completed order snapshot',
    async (_, txid, receiverTransactionId, to, amount, price) => {
      const { service } = createService();
      const networkId = 'evm--56';
      const token = {
        contractAddress: '0xABC',
        networkId,
        symbol: 'SNDKB',
        decimals: 18,
        balanceMultiplier: '1',
      };
      const order: ISwapTxHistory = {
        status: ESwapTxHistoryStatus.SUCCESS,
        txInfo: {
          txId: 'fill',
          receiverTransactionId,
          sender: 'sender',
          receiver: 'receiver',
        },
        accountInfo: { sender: { networkId }, receiver: { networkId } },
        baseInfo: {
          fromToken: receiverTransactionId
            ? { ...token, networkId: 'evm--1' }
            : token,
          toToken: token,
          fromAmount: '2',
          toAmount: '2',
        },
        swapInfo: {
          provider: { provider: 'test', providerName: 'Test' },
          instantRate: '1',
        },
        date: { created: 1, updated: 1 },
      };
      const row = tx(EDecodedTxStatus.Confirmed);
      row.isLocalCreated = false;
      const leg = {
        tokenIdOnNetwork: '0xabc',
        from: 'sender',
        to,
        icon: '',
        name: 'Stock',
        symbol: 'SNDKB',
        amount: '16',
        rawAmount: receiverTransactionId ? undefined : '2',
        balanceMultiplier: '8',
        price: '10',
      };
      Object.assign(row.decodedTx, {
        networkId,
        txid,
        isFinal: true,
        actions: [
          {
            type: EDecodedTxActionType.ASSET_TRANSFER,
            assetTransfer: { from: 'sender', to, sends: [], receives: [leg] },
          },
        ],
      });
      const getSwapHistoryList = jest.fn(async () => [order]);
      Object.assign(service.backgroundApi.simpleDb, {
        localHistory: {
          getAccountLocalHistoryConfirmedTxs: async () => [row],
          getAccountLocalHistoryPendingTxs: async () => [],
        },
        swapHistory: { getSwapHistoryList },
      });
      Object.assign(service.backgroundApi, {
        serviceAccount: {
          getAccountAddressForApi: async () => 'addr',
          getAccountXpub: async () => undefined,
        },
      });
      const scope = { accountId: 'acc', accountAddress: 'addr', networkId };
      getSwapHistoryList.mockRejectedValueOnce(new Error('store unavailable'));
      expect((await service.getAccountsLocalHistoryTxs(scope))[0]).toBe(row);
      getSwapHistoryList.mockResolvedValueOnce([
        { ...order, status: ESwapTxHistoryStatus.PENDING },
      ]);
      expect((await service.getAccountsLocalHistoryTxs(scope))[0]).toBe(row);
      const [completed] = await service.getAccountsLocalHistoryTxs(scope);
      const detail = await service.decodeOnChainHistoryTx({
        ...scope,
        cachedTx: row,
      });
      expect(detail).toEqual(completed);
      expect(leg).toMatchObject({
        amount: '16',
        price: '10',
        balanceMultiplier: '8',
      });
      expect(
        completed.decodedTx.actions[0].assetTransfer?.receives[0],
      ).toMatchObject({ amount, price });
      expect(
        await service.decodeOnChainHistoryTx({ ...scope, cachedTx: completed }),
      ).toEqual(completed);
      expect(getSwapHistoryDisplayToAmount(order)).toBe('2');
    },
  );

  it('refreshes an older off-page token transfer from raw detail once and retries after a failed request', async () => {
    const { service, batchUpdateLocalHistoryTxs } = createService();
    const networkId = 'evm--56';
    const legacy = tx(EDecodedTxStatus.Confirmed);
    const transfer = {
      from: 'sender',
      to: 'addr',
      amount: '2',
      icon: '',
      name: 'Stock',
      symbol: 'SNDKB',
      tokenIdOnNetwork: 'stock',
    };
    legacy.isLocalCreated = false;
    Object.assign(legacy.decodedTx, { networkId, isFinal: true });
    const assetTransfer = {
      from: 'sender',
      to: 'addr',
      sends: [],
      receives: [transfer],
    };
    legacy.decodedTx.actions = [
      { type: EDecodedTxActionType.ASSET_TRANSFER, assetTransfer },
    ];
    const receipt = {
      data: {
        tx: legacy.decodedTx.txid,
        receives: [{ ...transfer, token: 'stock', key: 'stock' }],
        sends: [],
      },
      tokens: { stock: { info: { balanceMultiplier: '8' } } },
      nfts: {},
    } as unknown as NonNullable<
      Awaited<ReturnType<typeof service.fetchHistoryTxDetails>>
    >;
    const details = jest
      .spyOn(service, 'fetchHistoryTxDetails')
      .mockResolvedValueOnce(null)
      .mockResolvedValue(receipt);
    const refresh = async (cached: IAccountHistoryTx) =>
      (
        await service.batchUpdateLocalHistoryTxs([
          {
            networkId,
            accountAddress: 'addr',
            onChainHistoryTxs: [],
            confirmedTxs: [cached],
            pendingTxs: [],
            pendingTxsToModify: [],
          },
        ])
      ).allConfirmedTxsToSave[0];
    const clock = jest.spyOn(Date, 'now');
    try {
      expect(await refresh(legacy)).toEqual(legacy);
      expect(await refresh(legacy)).toEqual(legacy);
      expect(details).toHaveBeenCalledTimes(1);
      clock.mockReturnValue(Date.now() + 6 * 60_000);
      let release!: () => void;
      const slow = new Promise<void>((resolve) => {
        release = resolve;
      });
      details.mockImplementationOnce(async () => {
        await slow;
        return receipt;
      });
      expect(await refresh(legacy)).toEqual(legacy);
      expect(
        legacy.decodedTx.actions[0].assetTransfer?.receives[0].amount,
      ).toBe('2');
      release();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      const online = await refresh(legacy);
      expect(
        online.decodedTx.actions[0].assetTransfer?.receives[0].amount,
      ).toBe('16');
      expect(await refresh(online)).toEqual(online);
      expect(details).toHaveBeenCalledTimes(2);
      expect(
        online.decodedTx.actions[0].assetTransfer?.receives[0].rawAmount,
      ).toBe('2');
      expect(batchUpdateLocalHistoryTxs).toHaveBeenLastCalledWith([
        expect.objectContaining({ confirmedTxsToSave: [online] }),
      ]);
    } finally {
      clock.mockRestore();
    }
  });

  it.each([
    ['a local pending row', EDecodedTxStatus.Pending, localTx()],
    [
      'another pending row',
      EDecodedTxStatus.Pending,
      tx(EDecodedTxStatus.Pending),
    ],
    ['a confirmed row', EDecodedTxStatus.Confirmed, localTx()],
  ])(
    'hands over %s once the source lists it',
    async (_label, status, pendingTx) => {
      const { service } = createService();
      const result = await service.batchUpdateLocalHistoryTxs([
        {
          accountAddress: 'addr',
          networkId: 'btc--0',
          onChainHistoryTxs: [tx(status)],
          confirmedTxs: [],
          pendingTxs: [pendingTx],
          pendingTxsToModify: [],
        },
      ]);
      expect(result.allFinalPendingTxs).toHaveLength(0);
    },
  );
});

describe('ServiceHistory pending order across accounts (OK-66004)', () => {
  function pendingTx(networkId: string, createdAt: number): IAccountHistoryTx {
    return {
      id: `${networkId}_addr_txid-${createdAt}`,
      isLocalCreated: true,
      decodedTx: {
        txid: `txid-${createdAt}`,
        accountId: `acc-${networkId}`,
        networkId,
        status: EDecodedTxStatus.Pending,
        createdAt,
        actions: [],
        encodedTx: {},
      },
    } as unknown as IAccountHistoryTx;
  }

  it('keeps All Networks pending rows in time order instead of account order', async () => {
    // The local store hands the Home list its pending rows newest first
    // (DOGE, BCH, BTC). The All Networks refresh then re-ran them account by
    // account and concatenated the per-account results, so after the reload the
    // BTC row jumped above the two newer pending rows.
    const service = Object.assign(
      Object.create(ServiceHistory.prototype) as InstanceType<
        typeof ServiceHistory
      >,
      {
        backgroundApi: {
          serviceNetwork: { getVaultSettings: async () => ({}) },
          simpleDb: {
            localHistory: { batchUpdateLocalHistoryTxs: async () => undefined },
          },
        },
      },
    );
    const btc = pendingTx('btc--0', 1000);
    const doge = pendingTx('doge--0', 3000);
    const bch = pendingTx('bch--0', 2000);
    const result = await service.batchUpdateLocalHistoryTxs(
      [btc, doge, bch].map((pending) => ({
        accountAddress: 'addr',
        networkId: pending.decodedTx.networkId,
        onChainHistoryTxs: [],
        confirmedTxs: [],
        pendingTxs: [pending],
        pendingTxsToModify: [],
      })),
    );
    expect(result.allFinalPendingTxs.map((item) => item.id)).toEqual([
      doge.id,
      bch.id,
      btc.id,
    ]);
  });
});

describe('ServiceHistory clear pending transactions', () => {
  it('never touches local wallet send locks', async () => {
    const clearLocalHistoryPendingTxs = jest.fn(async () => undefined);
    const forEachLocalWalletCapability = jest.fn();
    const service = Object.assign(
      Object.create(ServiceHistory.prototype) as InstanceType<
        typeof ServiceHistory
      >,
      {
        backgroundApi: {
          simpleDb: { localHistory: { clearLocalHistoryPendingTxs } },
          servicePrivacyChain: { forEachLocalWalletCapability },
        },
      },
    );
    await service.clearLocalHistoryPendingTxs();
    expect(clearLocalHistoryPendingTxs).toHaveBeenCalled();
    expect(forEachLocalWalletCapability).not.toHaveBeenCalled();
  });
});
