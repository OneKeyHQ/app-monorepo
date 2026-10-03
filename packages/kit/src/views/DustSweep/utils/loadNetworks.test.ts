import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAllNetworkAccountsInfoResult } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { loadDustSweepNetworks } from './loadNetworks';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAllNetwork: {
      getAllNetworkAccounts: jest.fn(),
    },
    serviceSwap: {
      fetchSwapNetworks: jest.fn(),
    },
    serviceToken: {
      fetchAccountTokens: jest.fn(),
      getNativeToken: jest.fn(),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/config/networkIds', () => ({
  getNetworkIdsMap: () => ({ onekeyall: 'onekeyall--0' }),
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  isExternalAccount: () => false,
  isWatchingAccount: () => false,
}));

const serviceSwap = jest.mocked(backgroundApiProxy.serviceSwap);
const serviceAllNetwork = jest.mocked(backgroundApiProxy.serviceAllNetwork);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const params = {
  walletId: 'hd-test',
  accountId: 'hd-test--0',
  indexedAccountId: 'hd-test--0',
  entry: 'walletMore' as const,
};

describe('loadDustSweepNetworks request ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shares an in-flight load across a rapid leave and re-entry', async () => {
    const networks = deferred<ISwapNetwork[]>();
    const accounts = deferred<IAllNetworkAccountsInfoResult>();
    serviceSwap.fetchSwapNetworks.mockReturnValue(networks.promise);
    serviceAllNetwork.getAllNetworkAccounts.mockReturnValue(accounts.promise);

    const firstController = new AbortController();
    const first = loadDustSweepNetworks(params, firstController.signal);
    firstController.abort();
    const second = loadDustSweepNetworks(params, new AbortController().signal);

    expect(
      (serviceSwap.fetchSwapNetworks as jest.Mock).mock.calls,
    ).toHaveLength(1);
    expect(
      (serviceAllNetwork.getAllNetworkAccounts as jest.Mock).mock.calls,
    ).toHaveLength(1);

    await expect(first).rejects.toThrow('Dust Sweep cancelled');
    networks.resolve([]);
    accounts.resolve({
      accountsInfo: [],
      accountsInfoBackendIndexed: [],
      accountsInfoBackendNotIndexed: [],
      allAccountsInfo: [],
    });
    await expect(second).resolves.toEqual({
      networks: [],
      partialError: false,
    });
  });
});
