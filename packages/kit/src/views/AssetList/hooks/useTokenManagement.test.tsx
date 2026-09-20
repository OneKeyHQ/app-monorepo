/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { AGGREGATE_TOKEN_MOCK_NETWORK_ID } from '@onekeyhq/shared/src/consts/networkConsts';

const mockUsePromiseResult = jest.fn();
const mockGetAllNetworkAccounts = jest.fn();
const mockGetCustomTokensBatch = jest.fn();
const mockGetHiddenTokensBatch = jest.fn();
const mockGetCustomTokens = jest.fn();
const mockGetHiddenTokens = jest.fn();
const mockGetAggregateTokenConfigMap = jest.fn();
const mockGetRawTokenList = jest.fn();
const mockMergeBatch = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAllNetwork: {
      getAllNetworkAccounts: (...args: unknown[]): unknown =>
        mockGetAllNetworkAccounts(...args),
    },
    serviceCustomToken: {
      getCustomTokensBatch: (...args: unknown[]): unknown =>
        mockGetCustomTokensBatch(...args),
      getHiddenTokensBatch: (...args: unknown[]): unknown =>
        mockGetHiddenTokensBatch(...args),
      getCustomTokens: (...args: unknown[]): unknown =>
        mockGetCustomTokens(...args),
      getHiddenTokens: (...args: unknown[]): unknown =>
        mockGetHiddenTokens(...args),
    },
    serviceToken: {
      getAggregateTokenConfigMap: (...args: unknown[]): unknown =>
        mockGetAggregateTokenConfigMap(...args),
      mergeTokenMetadataWithCustomDataBatch: (...args: unknown[]): unknown =>
        mockMergeBatch(...args),
    },
    serviceTokenViewModel: {
      getRawTokenList: (...args: unknown[]): unknown =>
        mockGetRawTokenList(...args),
    },
    serviceNetwork: {
      getAllNetworks: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (...args: unknown[]): unknown =>
    mockUsePromiseResult(...args),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/tokenList', () => ({
  useListStructureAtom: () => [{ generation: 1 }],
}));

jest.mock('@onekeyhq/kit/src/components/TokenListView/utils', () => ({
  getTokenListOwnerCacheAccountId: () => 'owner-account',
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const { useTokenManagement } = jest.requireActual<
  typeof import('./useTokenManagement')
>('./useTokenManagement');

type IFetcherResult = {
  customTokens: unknown[];
  addedTokens: unknown[];
  sectionTokens: unknown[];
};

const accountsInfo = [
  { accountId: 'account-evm', networkId: 'evm--1' },
  { accountId: 'account-sol', networkId: 'sol--101' },
];
const expectedPairs = [
  ...accountsInfo,
  {
    accountId: 'indexed-1',
    accountXpubOrAddress: 'indexed-1',
    networkId: AGGREGATE_TOKEN_MOCK_NETWORK_ID,
  },
];
const customToken = {
  address: '0xcustom',
  networkId: 'evm--1',
  accountId: 'account-evm',
  $key: 'evm--1_0xcustom',
};

function renderTokenManagement(customTokensOnly: boolean) {
  renderHook(() =>
    useTokenManagement({
      accountId: 'account-all',
      networkId: getNetworkIdsMap().onekeyall,
      indexedAccountId: 'indexed-1',
      customTokensOnly,
    }),
  );
  const [fetcher, , options] = mockUsePromiseResult.mock.calls[0] as [
    () => Promise<IFetcherResult>,
    unknown[],
    { debounced?: number },
  ];
  return { fetcher, options };
}

describe('useTokenManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePromiseResult.mockReturnValue({
      result: undefined,
      run: jest.fn(),
      isLoading: false,
    });
    mockGetAllNetworkAccounts.mockResolvedValue({ accountsInfo });
    mockGetCustomTokensBatch.mockResolvedValue([customToken]);
    mockGetHiddenTokensBatch.mockResolvedValue([]);
    mockGetAggregateTokenConfigMap.mockResolvedValue({});
    mockGetRawTokenList.mockResolvedValue({ tokens: [] });
    mockMergeBatch.mockResolvedValue([customToken]);
  });

  it('reads only the custom tokens, in one request, for list consumers', async () => {
    const { fetcher, options } = renderTokenManagement(true);

    await expect(fetcher()).resolves.toEqual({
      sectionTokens: [],
      addedTokens: [],
      customTokens: [customToken],
    });

    expect(mockGetCustomTokensBatch).toHaveBeenCalledTimes(1);
    expect(mockGetCustomTokensBatch).toHaveBeenCalledWith({
      pairs: expectedPairs,
    });
    expect(mockGetHiddenTokensBatch).not.toHaveBeenCalled();
    expect(mockGetAggregateTokenConfigMap).not.toHaveBeenCalled();
    expect(mockGetRawTokenList).not.toHaveBeenCalled();
    expect(mockMergeBatch).not.toHaveBeenCalled();
    // Structure-generation bumps arrive once per settling network.
    expect(options.debounced).toBe(300);
  });

  it('builds the token manager sections from one request per token status', async () => {
    const { fetcher, options } = renderTokenManagement(false);

    const result = await fetcher();

    expect(result.customTokens).toEqual([customToken]);
    expect(result.addedTokens).toEqual([customToken]);
    expect(mockGetCustomTokensBatch).toHaveBeenCalledTimes(1);
    expect(mockGetHiddenTokensBatch).toHaveBeenCalledTimes(1);
    expect(mockGetHiddenTokensBatch).toHaveBeenCalledWith({
      pairs: expectedPairs,
    });
    expect(mockGetCustomTokens).not.toHaveBeenCalled();
    expect(mockGetHiddenTokens).not.toHaveBeenCalled();
    expect(options.debounced).toBeUndefined();
  });
});
