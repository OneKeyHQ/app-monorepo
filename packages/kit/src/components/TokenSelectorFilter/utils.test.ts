import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IFetchAccountTokensResp } from '@onekeyhq/shared/types/token';

import {
  fetchSpecifiedTokenSelectorTokens,
  resolveIsSelectorAllNetworks,
} from './utils';

const globalMockBag = globalThis as typeof globalThis & {
  __specifiedTokenSelectorMocks?: {
    fetchAccountTokens: jest.Mock;
    getAllNetworkAccounts: jest.Mock;
  };
};

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const mocks = {
    fetchAccountTokens: jest.fn(),
    getAllNetworkAccounts: jest.fn(),
  };
  (
    globalThis as typeof globalThis & {
      __specifiedTokenSelectorMocks?: typeof mocks;
    }
  ).__specifiedTokenSelectorMocks = mocks;
  return {
    __esModule: true,
    default: {
      serviceToken: {
        fetchAccountTokens: mocks.fetchAccountTokens,
      },
      serviceAllNetwork: {
        getAllNetworkAccounts: mocks.getAllNetworkAccounts,
      },
    },
  };
});

const mocks = globalMockBag.__specifiedTokenSelectorMocks!;

function buildTokenResponse(networkId: string): IFetchAccountTokensResp {
  const tokenData = {
    data: [],
    keys: '',
    map: {},
  };
  return {
    networkId,
    tokens: tokenData,
    riskTokens: tokenData,
    smallBalanceTokens: tokenData,
  };
}

describe('resolveIsSelectorAllNetworks', () => {
  // Regression: TokenSelector used to derive all-networks mode from the
  // async-loaded network object, so the mount-frame self-fetch ran in
  // single-network mode and POSTed networkId `onekeyall--0` +
  // `AllNetworkMockAddress` to /wallet/v1/account/token/list (server 40003).
  // The mode must be derivable synchronously from the networkId alone.
  it('derives all-networks mode from the network id when the route param is missing', () => {
    expect(
      resolveIsSelectorAllNetworks({
        isAllNetworks: undefined,
        networkId: getNetworkIdsMap().onekeyall,
      }),
    ).toBe(true);
  });

  it('keeps single-network mode for real network ids', () => {
    expect(
      resolveIsSelectorAllNetworks({
        isAllNetworks: undefined,
        networkId: 'evm--1',
      }),
    ).toBe(false);
    expect(
      resolveIsSelectorAllNetworks({
        isAllNetworks: undefined,
        networkId: undefined,
      }),
    ).toBe(false);
  });

  it('never lets a stale false param force single-network mode on the all-network id', () => {
    expect(
      resolveIsSelectorAllNetworks({
        isAllNetworks: false,
        networkId: getNetworkIdsMap().onekeyall,
      }),
    ).toBe(true);
    expect(
      resolveIsSelectorAllNetworks({
        isAllNetworks: true,
        networkId: 'evm--1',
      }),
    ).toBe(true);
  });
});

describe('fetchSpecifiedTokenSelectorTokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests native coin balances alongside token balances without dropping the empty contract', async () => {
    const response = buildTokenResponse('evm--1');
    mocks.fetchAccountTokens.mockResolvedValue(response);

    const result = await fetchSpecifiedTokenSelectorTokens({
      accountId: 'account-1',
      networkId: 'evm--1',
      targets: [
        { networkId: 'evm--1', contractAddress: '' },
        { networkId: 'evm--1', contractAddress: '0xusdc' },
        { networkId: 'evm--1', contractAddress: '' },
      ],
    });

    expect(mocks.fetchAccountTokens).toHaveBeenCalledTimes(1);
    expect(mocks.fetchAccountTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: 'evm--1',
        contractList: ['', '0xusdc'],
      }),
    );
    expect(result.responsesByNetworkId['evm--1']).toBe(response);
    expect(result.issues).toEqual([]);
  });

  it('uses the same token-selector account-token request as Send', async () => {
    mocks.fetchAccountTokens.mockResolvedValue(buildTokenResponse('evm--1'));

    const result = await fetchSpecifiedTokenSelectorTokens({
      accountId: 'account-1',
      networkId: 'evm--1',
      indexedAccountId: 'wallet-1--1',
      targets: [
        {
          networkId: 'evm--1',
          contractAddress: '0xusdc',
        },
        {
          networkId: 'evm--1',
          contractAddress: '0xusdc',
        },
      ],
    });

    expect(mocks.getAllNetworkAccounts).not.toHaveBeenCalled();
    expect(mocks.fetchAccountTokens).toHaveBeenCalledTimes(1);
    expect(mocks.fetchAccountTokens).toHaveBeenCalledWith({
      accountId: 'account-1',
      networkId: 'evm--1',
      indexedAccountId: 'wallet-1--1',
      dbAccount: undefined,
      contractList: ['0xusdc'],
      flag: 'token-selector',
      saveToLocal: false,
    });
    expect(result.expectedResponseCount).toBe(1);
    expect(Object.keys(result.responsesByNetworkId)).toEqual(['evm--1']);
    expect(result.issues).toEqual([]);
  });

  it('keeps the expected network count when one network refresh fails', async () => {
    mocks.getAllNetworkAccounts.mockResolvedValue({
      accountsInfo: [
        {
          accountId: 'account-sol',
          networkId: 'sol--101',
          dbAccount: { id: 'db-account-sol' },
        },
      ],
    });
    mocks.fetchAccountTokens.mockImplementation(
      ({ networkId }: { networkId: string }) =>
        networkId === 'evm--1'
          ? Promise.resolve(buildTokenResponse(networkId))
          : Promise.reject(new Error('network unavailable')),
    );

    const result = await fetchSpecifiedTokenSelectorTokens({
      accountId: 'account-evm',
      networkId: 'evm--1',
      indexedAccountId: 'wallet-1--1',
      targets: [
        {
          networkId: 'evm--1',
          contractAddress: '0xusdc',
        },
        {
          networkId: 'sol--101',
          contractAddress: 'usdc-mint',
        },
      ],
    });

    expect(mocks.getAllNetworkAccounts).toHaveBeenCalledWith({
      accountId: 'account-evm',
      networkId: 'evm--1',
      indexedAccountId: 'wallet-1--1',
      fetchAllNetworkAccounts: true,
      networksEnabledOnly: false,
      excludeTestNetwork: false,
      excludeIncompatibleWithWalletAccounts: true,
    });
    expect(result.expectedResponseCount).toBe(2);
    expect(Object.keys(result.responsesByNetworkId)).toEqual(['evm--1']);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toEqual(new Error('network unavailable'));
  });
});
