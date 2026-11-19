/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');

import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

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
    const service = Object.assign(
      Object.create(ServiceHistory.prototype) as InstanceType<
        typeof ServiceHistory
      >,
      {
        backgroundApi: {
          serviceNetwork: { getVaultSettings: async () => ({}) },
          simpleDb: { localHistory: { batchUpdateLocalHistoryTxs } },
        },
      },
    );
    return { service, batchUpdateLocalHistoryTxs };
  }

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
