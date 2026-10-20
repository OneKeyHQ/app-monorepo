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

const mockGetVault = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: (...args: unknown[]) => mockGetVault(...args) },
}));

import type {
  IAccountHistoryTx,
  IFetchHistoryTxDetailsParams,
} from '@onekeyhq/shared/types/history';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import { getVaultSettings } from '../vaults/settings';

const ServiceHistory = require('./ServiceHistory')
  .default as typeof import('./ServiceHistory').default;

const ALL = 'onekeyall--0';
const ZEC = 'zec--0';
const XMR = 'xmr--0';

function row(
  networkId: string,
  txid: string,
  extra?: Partial<IAccountHistoryTx>,
): IAccountHistoryTx {
  return {
    id: `${networkId}_addr_${txid}`,
    decodedTx: {
      txid,
      accountId: `acc-${networkId}`,
      networkId,
      status: EDecodedTxStatus.Pending,
      actions: [],
    },
    ...extra,
  } as unknown as IAccountHistoryTx;
}

// Real vault settings, so the pools and their sources are the shipped ones.
function createService() {
  const fetchHistoryTxDetails = jest.fn(
    async (_params: IFetchHistoryTxDetailsParams) => null,
  );
  const post = jest.fn(async () => ({
    data: {
      data: {
        data: [],
        tokens: {},
        nfts: {},
        addressMap: {},
        hasMore: false,
      },
    },
  }));
  const service = Object.assign(
    Object.create(ServiceHistory.prototype) as InstanceType<
      typeof ServiceHistory
    >,
    {
      getClient: async () => ({ post }),
      getOneKeyIdAuthHeaders: async () => ({}),
      fetchHistoryTxDetails,
      backgroundApi: {
        serviceNetwork: {
          getVaultSettings: ({ networkId }: { networkId: string }) =>
            getVaultSettings({ networkId }),
          isCustomNetwork: async () => false,
          getNetwork: async () => ({ backendIndex: false }),
        },
        serviceAccount: {
          getDBAccount: async () => undefined,
          getAccountAddressForApi: async () => '',
          getAccountXpub: async () => undefined,
        },
        serviceAllNetwork: {
          getAllNetworkAccountsWithEnabledNetworks: async () => ({
            accountsInfo: [],
            allAccountsInfo: [],
          }),
        },
        serviceAccountProfile: { _getWalletTypeHeader: async () => ({}) },
      },
    },
  );
  return { service, fetchHistoryTxDetails };
}

describe('ServiceHistory All Networks privacy chain rows', () => {
  async function fetchAllNetworks(
    built: (IAccountHistoryTx | null)[],
    displayed?: { publicAddress?: string },
  ) {
    mockGetVault.mockResolvedValue({
      fetchAccountHistoryFromLocal: async () => undefined,
      buildFetchHistoryListParams: async () => ({ allNetworkAccounts: [] }),
      buildOnChainHistoryTx: async ({ index }: { index: number }) =>
        built[index],
    });
    const { service } = createService();
    Object.assign(service.backgroundApi, {
      servicePrivacyChain: {
        getLocalWalletAccountAddresses: async () => displayed,
      },
    });
    jest.spyOn(service, 'getClient').mockResolvedValue({
      post: async () => ({
        data: {
          data: {
            data: built.map(() => ({})),
            tokens: {},
            nfts: {},
            addressMap: {},
            hasMore: false,
          },
        },
      }),
    } as never);
    return service.fetchAccountOnChainHistory({
      accountId: 'hd-1',
      networkId: ALL,
      accountAddress: '',
    });
  }

  it('tags Zcash backend rows with the backend pool and leaves other chains untouched', async () => {
    const btc = row('btc--0', 'b1');
    const evm = row('evm--1', 'e1');
    const zec = row(ZEC, 'z1');
    const { txs } = await fetchAllNetworks([btc, zec, evm]);
    expect(txs).toHaveLength(3);
    expect(txs[0]).toBe(btc);
    expect(txs[2]).toBe(evm);
    expect(txs[0]).toEqual(row('btc--0', 'b1'));
    expect(txs[2]).toEqual(row('evm--1', 'e1'));
    expect(txs[1]).toEqual({
      ...zec,
      privacyChainHistorySide: 'public',
      privacyChainHistoryPoolIds: [0],
    });
  });

  it('names legacy Zcash change by pool and leaves BTC change as is', async () => {
    const own = `t1${'A'.repeat(33)}`;
    const change = `t1${'H'.repeat(33)}`;
    const withChange = (networkId: string) =>
      row(networkId, 'c1', {
        decodedTx: {
          ...row(networkId, 'c1').decodedTx,
          owner: own,
          actions: [
            {
              type: EDecodedTxActionType.ASSET_TRANSFER,
              assetTransfer: {
                from: own,
                to: '',
                sends: [],
                receives: [{ from: own, to: change, isOwn: true }],
              },
            },
          ],
        },
      } as unknown as Partial<IAccountHistoryTx>);
    const btc = withChange('btc--0');
    const { txs } = await fetchAllNetworks([btc, withChange(ZEC)], {
      publicAddress: own,
    });
    expect(txs[0]).toBe(btc);
    expect(
      txs[1]?.decodedTx.actions[0].assetTransfer?.receives[0],
    ).toMatchObject({ to: '', shieldedTo: { poolId: 0, isOwn: true } });
  });

  it('returns the same rows when no privacy chain row is present', async () => {
    const built = [row('btc--0', 'b1'), row('evm--1', 'e1')];
    const { txs } = await fetchAllNetworks(built);
    expect(txs).toHaveLength(2);
    txs.forEach((tx, index) => expect(tx).toBe(built[index]));
  });

  it('drops rows of a chain with no backend pool', async () => {
    const { txs } = await fetchAllNetworks([
      row('btc--0', 'b1'),
      row(XMR, 'x1'),
    ]);
    expect(txs.map((tx) => tx?.decodedTx.networkId)).toEqual(['btc--0']);
  });

  it('does not tag rows outside All Networks', async () => {
    const zec = row(ZEC, 'z1');
    mockGetVault.mockResolvedValue({
      fetchAccountHistoryFromLocal: async () => undefined,
      buildFetchHistoryListParams: async () => ({}),
      buildOnChainHistoryTx: async () => zec,
    });
    const { service } = createService();
    jest.spyOn(service, 'getClient').mockResolvedValue({
      post: async () => ({
        data: {
          data: {
            data: [{}],
            tokens: {},
            nfts: {},
            addressMap: {},
            hasMore: false,
          },
        },
      }),
    } as never);
    const { txs } = await service.fetchAccountOnChainHistory({
      accountId: 'hd-1',
      networkId: 'btc--0',
      accountAddress: 'addr',
    });
    expect(txs[0]).toBe(zec);
  });
});

describe('ServiceHistory local pending detail routing', () => {
  async function pendingDetailParams(pending: IAccountHistoryTx[]) {
    const { service, fetchHistoryTxDetails } = createService();
    const stop = new Error('stop after detail requests');
    Object.assign(service, {
      getAccountsLocalHistoryPendingTxs: async () => pending,
      getDroppedPendingTxs: async () => {
        throw stop;
      },
    });
    await expect(
      service.fetchAccountHistory({ accountId: 'hd-1', networkId: ALL }),
    ).rejects.toBe(stop);
    return fetchHistoryTxDetails.mock.calls.map(([params]) => params);
  }

  it('names the backend pool for a Zcash row on the transparent pool only', async () => {
    const [params] = await pendingDetailParams([
      row(ZEC, 'z1', {
        privacyChainHistorySide: 'public',
        privacyChainHistoryPoolIds: [0],
      }),
    ]);
    expect(params).toMatchObject({ networkId: ZEC, privacyChainPoolId: 0 });
  });

  it('leaves the pool unnamed for a row touching a local-scan pool', async () => {
    const [params] = await pendingDetailParams([
      row(ZEC, 'z1', {
        privacyChainHistorySide: 'mixed',
        privacyChainHistoryPoolIds: [0, 4],
      }),
    ]);
    expect(params.privacyChainPoolId).toBeUndefined();
  });

  it('sends the same detail request as before for BTC and EVM rows', async () => {
    const [btc, evm] = await pendingDetailParams([
      row('btc--0', 'b1'),
      row('evm--1', 'e1'),
    ]);
    for (const [params, networkId, txid] of [
      [btc, 'btc--0', 'b1'],
      [evm, 'evm--1', 'e1'],
    ] as const) {
      expect(params).toEqual({
        accountId: `acc-${networkId}`,
        networkId,
        txid,
        txInvolvedAddresses: expect.any(Array),
        privacyChainPoolId: undefined,
      });
    }
  });
});

describe('ServiceHistory vault history source', () => {
  it.each([true, false])(
    'passes the manual refresh flag (%s) to the vault',
    async (isManualRefresh) => {
      const fetchAccountHistoryFromLocal = jest.fn(async () => []);
      mockGetVault.mockResolvedValue({ fetchAccountHistoryFromLocal });
      const { service } = createService();
      const post = jest.fn();
      jest.spyOn(service, 'getClient').mockResolvedValue({ post } as never);
      await service.fetchAccountOnChainHistory({
        accountId: 'hd-1',
        networkId: ZEC,
        accountAddress: 't1-own',
        isManualRefresh,
      });
      expect(fetchAccountHistoryFromLocal).toHaveBeenCalledWith(
        expect.objectContaining({ isManualRefresh }),
      );
      expect(post).not.toHaveBeenCalled();
    },
  );
});
