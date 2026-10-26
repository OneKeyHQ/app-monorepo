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

import { getVaultSettings } from '../vaults/settings';

const ServiceHistory = require('./ServiceHistory')
  .default as typeof import('./ServiceHistory').default;

const XMR = 'xmr--0';

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
});
