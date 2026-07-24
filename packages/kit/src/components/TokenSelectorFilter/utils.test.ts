import type { IFetchAccountTokensResp } from '@onekeyhq/shared/types/token';

import { fetchSpecifiedTokenSelectorTokens } from './utils';

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

describe('fetchSpecifiedTokenSelectorTokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
  });
});
