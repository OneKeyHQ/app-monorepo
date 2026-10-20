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

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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

// Indexer-backed chains hand a pending row over to the indexer as soon as it
// sees the tx. A vault-authoritative source keeps the local row until the tx
// resolves.
describe('ServiceHistory local pending reconciliation', () => {
  function createService(authoritative = false) {
    const batchUpdateLocalHistoryTxs = jest.fn(async () => undefined);
    const service = Object.assign(
      Object.create(ServiceHistory.prototype) as InstanceType<
        typeof ServiceHistory
      >,
      {
        backgroundApi: {
          serviceNetwork: {
            getVaultSettings: async () =>
              authoritative
                ? { localWallet: { historySource: 'vault-authoritative' } }
                : {},
          },
          simpleDb: { localHistory: { batchUpdateLocalHistoryTxs } },
        },
      },
    );
    return { service, batchUpdateLocalHistoryTxs };
  }

  async function reconcile(
    onChainStatus: EDecodedTxStatus,
    authoritative = false,
    pendingTx = localTx(),
  ) {
    const { service } = createService(authoritative);
    return service.batchUpdateLocalHistoryTxs([
      {
        accountAddress: 'addr',
        networkId: 'btc--0',
        onChainHistoryTxs: [tx(onChainStatus)],
        confirmedTxs: [],
        pendingTxs: [pendingTx],
        pendingTxsToModify: [],
      },
    ]);
  }

  it('hands the local row to the indexer once it reports the tx, even as pending', async () => {
    const result = await reconcile(EDecodedTxStatus.Pending);
    expect(result.allFinalPendingTxs).toHaveLength(0);
  });

  it('keeps the local row pending while an authoritative source still says pending', async () => {
    const result = await reconcile(EDecodedTxStatus.Pending, true);
    expect(result.allFinalPendingTxs).toHaveLength(1);
  });

  it('hands a pending row this device did not send to the authoritative snapshot', async () => {
    const result = await reconcile(
      EDecodedTxStatus.Pending,
      true,
      tx(EDecodedTxStatus.Pending),
    );
    expect(result.allFinalPendingTxs).toHaveLength(0);
  });

  it.each([localTx(), tx(EDecodedTxStatus.Pending)])(
    'leaves indexer-backed chains unchanged for any pending row',
    async (pendingTx) => {
      const result = await reconcile(
        EDecodedTxStatus.Pending,
        false,
        pendingTx,
      );
      expect(result.allFinalPendingTxs).toHaveLength(0);
    },
  );

  it('settles the local row once the indexer confirms it', async () => {
    const result = await reconcile(EDecodedTxStatus.Confirmed);
    expect(result.allFinalPendingTxs).toHaveLength(0);
  });

  it('uses and persists authoritative Pending refinements instead of the earlier cache read', async () => {
    const { service, batchUpdateLocalHistoryTxs } = createService(true);
    const refined = tx(EDecodedTxStatus.Pending);
    refined.decodedTx.broadcastOutcomeUnknown = true;
    refined.decodedTx.createdAt = 1;
    const result = await service.batchUpdateLocalHistoryTxs([
      {
        accountAddress: 'addr',
        networkId: 'btc--0',
        onChainHistoryTxs: [refined],
        confirmedTxs: [],
        pendingTxs: [localTx()],
        pendingTxsToModify: [],
      },
    ]);
    expect(result.allFinalPendingTxs[0].decodedTx).toMatchObject({
      broadcastOutcomeUnknown: true,
      createdAt: 1,
    });
    expect(batchUpdateLocalHistoryTxs).toHaveBeenCalledWith([
      expect.objectContaining({
        pendingTxsToModify: [
          expect.objectContaining({ decodedTx: refined.decodedTx }),
        ],
      }),
    ]);
  });

  it.each([true, false])(
    'only removes missing confirmed history from a full vault snapshot (all networks=%s)',
    async (isAllNetworks) => {
      const { service, batchUpdateLocalHistoryTxs } = createService(true);
      const confirmed = tx(EDecodedTxStatus.Confirmed);
      const result = await service.batchUpdateLocalHistoryTxs(
        [
          {
            accountAddress: 'addr',
            networkId: 'btc--0',
            onChainHistoryTxs: [],
            confirmedTxs: [confirmed],
            pendingTxs: [],
            pendingTxsToModify: [],
          },
        ],
        { isAllNetworks },
      );
      expect(result.allConfirmedTxsToSave).toEqual(
        isAllNetworks ? [confirmed] : [],
      );
      expect(batchUpdateLocalHistoryTxs).toHaveBeenCalledWith([
        expect.objectContaining({
          confirmedTxsToRemove: isAllNetworks ? [] : [confirmed],
        }),
      ]);
    },
  );
});

describe('ServiceHistory clear pending transactions', () => {
  function createService(clearPendingSends: () => Promise<void>) {
    const clearLocalHistoryPendingTxs = jest.fn(async () => undefined);
    const service = Object.assign(
      Object.create(ServiceHistory.prototype) as InstanceType<
        typeof ServiceHistory
      >,
      {
        backgroundApi: {
          simpleDb: { localHistory: { clearLocalHistoryPendingTxs } },
          servicePrivacyChain: {
            forEachLocalWalletCapability: async (
              fn: (capability: object) => Promise<void>,
            ) => {
              await fn({ clearPendingSends });
              await fn({});
            },
          },
        },
      },
    );
    return { service, clearLocalHistoryPendingTxs };
  }

  it('also releases local wallet send locks', async () => {
    const clearPendingSends = jest.fn(async () => undefined);
    const { service, clearLocalHistoryPendingTxs } =
      createService(clearPendingSends);
    await service.clearLocalHistoryPendingTxs();
    expect(clearLocalHistoryPendingTxs).toHaveBeenCalled();
    expect(clearPendingSends).toHaveBeenCalled();
  });

  it('keeps the general clear when a local wallet fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { service, clearLocalHistoryPendingTxs } = createService(async () => {
      throw new OneKeyLocalError('zcash storage unavailable');
    });
    await expect(
      service.clearLocalHistoryPendingTxs(),
    ).resolves.toBeUndefined();
    expect(clearLocalHistoryPendingTxs).toHaveBeenCalled();
  });
});
