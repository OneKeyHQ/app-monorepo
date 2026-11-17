/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');

const mockGetVault = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: (...args: unknown[]) => mockGetVault(...args) },
}));

const mockSettingsCurrencyId = jest.fn(() => 'usd');
jest.mock('../states/jotai/atoms', () => ({
  ...jest.requireActual<typeof import('../states/jotai/atoms')>(
    '../states/jotai/atoms',
  ),
  settingsPersistAtom: {
    get: async () => ({ currencyInfo: { id: mockSettingsCurrencyId() } }),
  },
  perpsDepositOrderAtom: { get: async () => ({ orders: [] }) },
}));

import { convertHistoryTxsFiatCurrency } from '@onekeyhq/shared/src/utils/historyUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type {
  IAccountHistoryTx,
  IFetchHistoryTxDetailsParams,
  IFetchHistoryTxDetailsResp,
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

function createService() {
  const fetchHistoryTxDetails = jest.fn(
    async (
      _params: IFetchHistoryTxDetailsParams,
    ): Promise<IFetchHistoryTxDetailsResp | null> => null,
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
    // Every server row also records the currency it was priced in.
    expect(txs[0]).toEqual(row('btc--0', 'b1', { fiatCurrency: 'usd' }));
    expect(txs[2]).toEqual(row('evm--1', 'e1', { fiatCurrency: 'usd' }));
    expect(txs[1]).toEqual({
      ...zec,
      privacyChainHistorySide: 'public',
      privacyChainHistoryPoolIds: [0],
    });
  });

  it('shows Zcash change as it is, as BTC does', async () => {
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
    ).toMatchObject({ to: change, isOwn: true });
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

describe('ServiceHistory server row fiat currency', () => {
  it('requests the page in the display currency and records it on the rows', async () => {
    mockSettingsCurrencyId.mockReturnValueOnce('cny');
    mockGetVault.mockResolvedValue({
      fetchAccountHistoryFromLocal: async () => undefined,
      buildFetchHistoryListParams: async () => ({}),
      buildOnChainHistoryTx: async () => row('evm--1', 'e1'),
    });
    const { service } = createService();
    const post = jest.fn(
      async (_url: string, _body: unknown, _config: unknown) => ({
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
    );
    jest.spyOn(service, 'getClient').mockResolvedValue({ post } as never);

    const { txs } = await service.fetchAccountOnChainHistory({
      accountId: 'hd-1',
      networkId: 'evm--1',
      accountAddress: '0xabc',
    });

    expect(post.mock.calls[0][2]).toMatchObject({
      headers: { 'x-onekey-request-currency': 'cny' },
    });
    expect(txs.map((tx) => tx?.fiatCurrency)).toEqual(['cny']);
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
        requestCurrency: 'usd',
      });
    }
  });
});

describe('ServiceHistory pending row confirmed after a currency switch', () => {
  const currencyMap = {
    usd: { id: 'usd', value: '1' },
    cny: { id: 'cny', value: '7' },
  } as unknown as Record<string, ICurrencyItem>;

  // Sent with an estimated fee of 0.002 priced at 1, unless `fee` says
  // otherwise.
  function pendingRow(
    fiatCurrency?: string,
    fee?: { totalFeeInNative: string | undefined },
  ) {
    const base = row('evm--1', 'e1', { fiatCurrency });
    return {
      ...base,
      decodedTx: {
        ...base.decodedTx,
        totalFeeInNative: '0.002',
        totalFeeFiatValue: '1',
        ...fee,
        actions: [
          {
            type: EDecodedTxActionType.ASSET_TRANSFER,
            assetTransfer: {
              from: '0xfrom',
              to: '0xto',
              sends: [{ amount: '1', price: '2' }],
              receives: [],
            },
          },
        ],
      },
    } as unknown as IAccountHistoryTx;
  }

  // Runs the history fetch up to the rows built from confirmed details, with
  // the display currency already switched to CNY.
  async function confirm(
    pending: IAccountHistoryTx,
    detail: { gasFee?: string; gasFeeFiatValue?: string },
  ) {
    mockSettingsCurrencyId.mockReturnValueOnce('cny');
    const { service, fetchHistoryTxDetails } = createService();
    fetchHistoryTxDetails.mockImplementation(
      async ({ txid }) =>
        ({
          data: {
            tx: txid,
            status: EOnChainHistoryTxStatus.Success,
            gasFee: '0.002',
            ...detail,
          },
        }) as unknown as IFetchHistoryTxDetailsResp,
    );
    const stop = new Error('stop after confirmed rows');
    let confirmed: IAccountHistoryTx[] = [];
    Object.assign(service.backgroundApi.serviceAccount, {
      getDBAccountSafe: async () => undefined,
    });
    Object.assign(service, {
      getAccountsLocalHistoryPendingTxs: async () => [pending],
      getDroppedPendingTxs: async () => [],
      getAccountsLocalHistoryConfirmedTxs: async () => [],
      fetchAccountOnChainHistory: async () => ({
        txs: [],
        addressMap: {},
        hasMore: false,
      }),
      attachPrivateSendDisplayStatus: async (txs: IAccountHistoryTx[]) => {
        confirmed = txs;
        throw stop;
      },
    });
    await expect(
      service.fetchAccountHistory({
        accountId: 'hd-1',
        networkId: ALL,
        currencyMap,
      }),
    ).rejects.toBe(stop);
    const [tx] = confirmed;
    return {
      tx,
      detailParams: fetchHistoryTxDetails.mock.calls[0][0],
      status: tx.decodedTx.status,
      fiatCurrency: tx.fiatCurrency,
      feeInNative: tx.decodedTx.totalFeeInNative,
      fee: tx.decodedTx.totalFeeFiatValue,
      sendPrice: tx.decodedTx.actions[0].assetTransfer?.sends[0].price,
    };
  }

  it('prices the detail in one named currency', async () => {
    const { detailParams } = await confirm(pendingRow('usd'), {});
    expect(detailParams.requestCurrency).toBe('cny');
  });

  it('keeps the detail fee as priced and converts the rest of the row to its currency', async () => {
    // Sent under USD, stamped USD by the switch, confirmed under CNY.
    const result = await confirm(pendingRow('usd'), { gasFeeFiatValue: '21' });
    expect(result).toMatchObject({
      status: EDecodedTxStatus.Confirmed,
      fiatCurrency: 'cny',
      fee: '21',
      sendPrice: '14',
    });
  });

  it('converts the pending fee when the detail carries none', async () => {
    const result = await confirm(pendingRow('usd'), {});
    expect(result).toMatchObject({
      fiatCurrency: 'cny',
      fee: '7',
      sendPrice: '14',
    });
  });

  it('keeps the pending snapshot and its currency when a rate is unavailable', async () => {
    // No EUR rate: the row cannot be brought to CNY, and the row built here
    // is the one saved to the cache.
    const result = await confirm(pendingRow('eur'), { gasFeeFiatValue: '21' });
    expect(result).toMatchObject({
      status: EDecodedTxStatus.Confirmed,
      fiatCurrency: 'eur',
      fee: '1',
      sendPrice: '2',
    });
  });

  it('prices the fee actually paid from the pending snapshot when a rate is unavailable', async () => {
    // Estimated 0.001 for 1 EUR, paid 0.0002 which the detail prices at 2.8
    // CNY. The saved row stays in EUR, so it cannot take the CNY value, and
    // the estimate's 1 EUR is not the price of the fee paid either.
    const result = await confirm(
      pendingRow('eur', { totalFeeInNative: '0.001' }),
      { gasFee: '0.0002', gasFeeFiatValue: '2.8' },
    );
    expect(result).toMatchObject({
      status: EDecodedTxStatus.Confirmed,
      fiatCurrency: 'eur',
      feeInNative: '0.0002',
      fee: '0.2',
      sendPrice: '2',
    });

    // The saved row is read again once the EUR rate is back.
    const [reread] = convertHistoryTxsFiatCurrency({
      txs: [result.tx],
      targetCurrency: 'cny',
      currencyMap: {
        ...currencyMap,
        eur: { id: 'eur', value: '0.5' },
      } as unknown as Record<string, ICurrencyItem>,
      hideUnconvertible: true,
    });
    expect(reread).toMatchObject({
      fiatCurrency: 'cny',
      decodedTx: { totalFeeInNative: '0.0002', totalFeeFiatValue: '2.8' },
    });
  });

  it('saves no fiat fee when the pending snapshot cannot price the fee paid', async () => {
    const result = await confirm(
      pendingRow('eur', { totalFeeInNative: undefined }),
      { gasFeeFiatValue: '21' },
    );
    expect(result).toMatchObject({
      fiatCurrency: 'eur',
      feeInNative: '0.002',
      sendPrice: '2',
    });
    expect(result.fee).toBeUndefined();
  });

  it('scales the pending fee to the fee paid when the detail carries no fiat fee', async () => {
    const result = await confirm(
      pendingRow('usd', { totalFeeInNative: '0.01' }),
      {},
    );
    expect(result).toMatchObject({
      fiatCurrency: 'cny',
      feeInNative: '0.002',
      fee: '1.4',
      sendPrice: '14',
    });
  });

  it('records the detail currency on a row that named none', async () => {
    const result = await confirm(pendingRow(), { gasFeeFiatValue: '21' });
    expect(result).toMatchObject({
      fiatCurrency: 'cny',
      fee: '21',
      sendPrice: '2',
    });
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

  it('aggregates and sorts merge-derive local history in BG without passing currencyMap across the bridge', async () => {
    const { service } = createService();
    const getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes = jest.fn(
      async () => ({
        networkAccounts: [
          { account: { id: 'btc-1' }, deriveType: 'default' },
          { account: { id: 'btc-2' }, deriveType: 'taproot' },
        ],
      }),
    );
    Object.assign(service.backgroundApi.serviceAccount, {
      getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes,
    });
    const spyLocal = jest
      .spyOn(service, 'getAccountsLocalHistoryTxs')
      .mockImplementation(async ({ accountId }) =>
        accountId === 'btc-1'
          ? [
              {
                ...row('btc--0', 'tx-older'),
                decodedTx: {
                  ...row('btc--0', 'tx-older').decodedTx,
                  updatedAt: 100,
                },
              } as IAccountHistoryTx,
            ]
          : [
              {
                ...row('btc--0', 'tx-newer'),
                decodedTx: {
                  ...row('btc--0', 'tx-newer').decodedTx,
                  updatedAt: 200,
                },
              } as IAccountHistoryTx,
            ],
      );

    const merged = await service.getAccountsLocalHistoryTxsForMergeDerive({
      indexedAccountId: 'indexed-1',
      networkId: 'btc--0',
      sourceCurrency: 'usd',
      limit: 1,
    });
    expect(
      getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes,
    ).toHaveBeenCalledTimes(1);
    expect(spyLocal).toHaveBeenCalledTimes(2);
    expect(merged.map((tx) => tx.decodedTx.txid)).toEqual(['tx-newer']);
  });
});
