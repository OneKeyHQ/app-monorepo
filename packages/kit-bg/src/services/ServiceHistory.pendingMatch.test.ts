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
