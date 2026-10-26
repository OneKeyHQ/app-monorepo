/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  const passthrough =
    () => (_target: unknown, _key?: string, descriptor?: PropertyDescriptor) =>
      descriptor;
  return {
    ...actual,
    backgroundClass: passthrough,
    backgroundMethod: passthrough,
  };
});

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

// A pending row is handed over to the history source as soon as the source
// lists the tx, even as pending.
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

  it.each(['zec--0', 'btc--0'])(
    'matches differently cased hashes only for Zcash, network=%s',
    async (networkId) => {
      const { service, batchUpdateLocalHistoryTxs } = createService();
      const pending = localTx();
      pending.id = 'local-lowercase';
      pending.decodedTx.networkId = networkId;
      pending.decodedTx.txid = 'ab'.repeat(32);
      const confirmed = tx(EDecodedTxStatus.Confirmed);
      confirmed.id = 'backend-uppercase';
      confirmed.decodedTx.networkId = networkId;
      confirmed.decodedTx.txid = pending.decodedTx.txid.toUpperCase();
      const result = await service.batchUpdateLocalHistoryTxs([
        {
          accountAddress: 'addr',
          networkId,
          onChainHistoryTxs: [confirmed],
          confirmedTxs: [],
          pendingTxs: [pending],
          pendingTxsToModify: [],
        },
      ]);
      expect(result.allFinalPendingTxs).toEqual(
        networkId === 'zec--0' ? [] : [pending],
      );
      if (networkId === 'zec--0')
        expect(batchUpdateLocalHistoryTxs).toHaveBeenCalledWith([
          expect.objectContaining({ confirmedTxs: [pending] }),
        ]);
    },
  );
});

describe('ServiceHistory clear pending transactions', () => {
  // Privacy-chain send locks are per account; an app-wide clear (settings,
  // or any chain's "pending queue too long" toast) must not reach them.
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
