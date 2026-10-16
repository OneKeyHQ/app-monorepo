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

import { getVaultSettings } from '../vaults/settings';

const ServiceHistory = require('./ServiceHistory')
  .default as typeof import('./ServiceHistory').default;

const XMR = 'xmr--0';
const ALL = 'onekeyall--0';

function createService() {
  const get = jest.fn(async () => ({
    data: { data: { supported: true, data: [] } },
  }));
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
  const getAccountAddressForApi = jest.fn(async () => 'addr');
  const service = Object.assign(
    Object.create(ServiceHistory.prototype) as InstanceType<
      typeof ServiceHistory
    >,
    {
      getClient: async () => ({ get, post }),
      getOneKeyIdAuthHeaders: async () => ({}),
      backgroundApi: {
        serviceNetwork: {
          getVaultSettings: async ({ networkId }: { networkId: string }) =>
            networkId === XMR
              ? { localWallet: { withholdAddressFromBackend: true } }
              : {},
          isCustomNetwork: async () => false,
          getNetwork: async () => ({ backendIndex: false }),
        },
        serviceAccount: {
          getAccountAddressForApi,
          safeGetAccountXpubsForAllDeriveTypes: async () => [],
        },
        serviceAccountProfile: { _getWalletTypeHeader: async () => ({}) },
        simpleDb: {
          transferRecipientsCache: { setEntry: async () => undefined },
        },
      },
    },
  );
  return { service, get, post, getAccountAddressForApi };
}

describe('ServiceHistory withholds addresses the backend cannot index', () => {
  it('declares the flag on Monero only', async () => {
    const xmr = await getVaultSettings({ networkId: XMR });
    const zec = await getVaultSettings({ networkId: 'zec--0' });
    expect(xmr.localWallet?.withholdAddressFromBackend).toBe(true);
    expect(zec.localWallet?.withholdAddressFromBackend).toBeUndefined();
  });

  it('skips the transfer-recipient request for a withholding network', async () => {
    const { service, get, getAccountAddressForApi } = createService();
    const result = await service.fetchTransferRecipients({
      accountId: 'hd-1--m/44/128',
      networkId: XMR,
    });
    expect(result).toEqual({ supported: false, data: [] });
    expect(get).not.toHaveBeenCalled();
    expect(getAccountAddressForApi).not.toHaveBeenCalled();
  });

  it('still queries transfer recipients for other networks', async () => {
    const { service, get } = createService();
    const result = await service.fetchTransferRecipients({
      accountId: 'hd-1--m/44/0',
      networkId: 'btc--0',
    });
    expect(result.supported).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('drops withholding accounts from the All Networks history request', async () => {
    const allNetworkAccounts = [
      { networkId: 'btc--0', accountId: 'a1', accountAddress: 'bc1' },
      { networkId: XMR, accountId: 'a2', accountAddress: '4xmr' },
      { networkId: 'zec--0', accountId: 'a3', accountAddress: 't1zec' },
    ];
    mockGetVault.mockResolvedValue({
      fetchAccountHistoryFromLocal: async () => undefined,
      buildFetchHistoryListParams: async () => ({ allNetworkAccounts }),
      buildOnChainHistoryTx: async () => undefined,
    });
    const { service, post } = createService();
    await service.fetchAccountOnChainHistory({
      accountId: 'hd-1',
      networkId: ALL,
      accountAddress: '',
    });
    expect(post).toHaveBeenCalledTimes(1);
    const body = (post.mock.calls[0] as unknown[])[1] as {
      allNetworkAccounts: { networkId: string; accountAddress: string }[];
    };
    expect(body.allNetworkAccounts.map((i) => i.networkId)).toEqual([
      'btc--0',
      'zec--0',
    ]);
    expect(JSON.stringify(body)).not.toContain('4xmr');
  });
});
