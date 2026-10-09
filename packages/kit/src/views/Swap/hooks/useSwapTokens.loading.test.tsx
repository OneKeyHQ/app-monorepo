/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { buildSwapAllNetworkTokenListCacheKey } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import type {
  IFetchTokensParams,
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapTokenList } from './useSwapTokens';

const network: ISwapNetwork = {
  networkId: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
  supportSingleSwap: true,
  supportLimit: false,
  supportStock: false,
  backendIndex: true,
  isDeFiEnabled: true,
};
const token: ISwapToken = {
  networkId: network.networkId,
  contractAddress: '0xtoken',
  decimals: 18,
  symbol: 'TOKEN',
  balanceParsed: '1',
  price: '1',
};
let mockNetworks = [network];
let mockFocused = true;
let mockTokenCatch: Record<string, { data: ISwapToken[] }> = {};
let mockAllNetworkLists: Record<string, ISwapToken[]> = {};
const mockGetSupportAccounts = jest
  .fn<
    Promise<{
      supportAccountsFetchFailed: boolean;
      swapSupportAccounts: IAllNetworkAccountInfo[];
    }>,
    [unknown]
  >()
  .mockResolvedValue({
    supportAccountsFetchFailed: false,
    swapSupportAccounts: [],
  });
const mockFetchTokenList = jest.fn<Promise<void>, [IFetchTokensParams]>();
const mockLoadAllNetworks = jest.fn<Promise<void>, unknown[]>();
const mockActions = {
  tokenListFetchAction: mockFetchTokenList,
  swapLoadAllNetworkTokenList: mockLoadAllNetworks,
};
const mockAccountInfo = { indexedAccount: { id: 'loading-test-account' } };

jest.mock('@onekeyhq/components', () => ({ useIsOverlayPage: () => false }));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockFocused,
}));
jest.mock('../../../hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('./useSwapAccount', () => ({
  useSwapAddressInfo: () => ({ accountInfo: mockAccountInfo }),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      getSupportSwapAllAccounts: (params: unknown) =>
        mockGetSupportAccounts(params),
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd' } }],
}));
jest.mock('../../../states/jotai/contexts/swap', () => ({
  useSwapActions: () => ({ current: mockActions }),
  useSwapTokenMapAtom: () => [{ tokenCatch: mockTokenCatch }],
  useSwapAllNetworkTokenListMapAtom: () => [mockAllNetworkLists],
  useSwapNetworksAtom: () => [mockNetworks],
  useSwapNetworksIncludeAllNetworkAtom: () => [mockNetworks],
  useSwapSelectTokenNetworkAtom: () => [undefined],
  useSwapTokenFetchingAtom: () => [false],
}));

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function cacheAllNetworks(tokens: ISwapToken[]) {
  mockAllNetworkLists = {
    [buildSwapAllNetworkTokenListCacheKey({
      accountId: mockAccountInfo.indexedAccount.id,
      lpToken: false,
      currency: 'usd',
      protocol: ESwapTabSwitchType.SWAP,
    })]: tokens,
  };
}

function cacheScopedTokens(params: IFetchTokensParams, tokens: ISwapToken[]) {
  mockTokenCatch = {
    ...mockTokenCatch,
    [JSON.stringify(params)]: { data: tokens },
  };
}

function renderList(networkId = network.networkId) {
  return renderHook(() =>
    useSwapTokenList(
      ESwapDirectionType.FROM,
      networkId,
      undefined,
      ESwapTabSwitchType.SWAP,
      false,
    ),
  );
}

describe('useSwapTokenList loading lifecycle', () => {
  beforeEach(() => {
    appEventBus.emit(EAppEventBusNames.GlobalDeriveTypeUpdate, undefined);
    jest.clearAllMocks();
    mockNetworks = [network];
    mockFocused = true;
    mockTokenCatch = {};
    mockAllNetworkLists = {};
    mockGetSupportAccounts.mockResolvedValue({
      supportAccountsFetchFailed: false,
      swapSupportAccounts: [],
    });
    mockLoadAllNetworks.mockResolvedValue(undefined);
  });

  it.each<{ holdings: ISwapToken[] }>([
    { holdings: [] },
    { holdings: [{ ...token, networkId: 'evm--56' }] },
  ])(
    'waits for the selected network when the all-network snapshot provides no rows ($holdings)',
    async ({ holdings }) => {
      cacheAllNetworks(holdings);
      const request = deferred();
      mockFetchTokenList.mockImplementation(async (params) => {
        await request.promise;
        cacheScopedTokens(params, [token]);
      });
      const { result, unmount } = renderList();
      await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalled());
      expect(result.current.currentTokens).toEqual([]);
      expect(result.current.fetchLoading).toBe(true);

      await act(async () => {
        request.resolve();
      });
      expect(result.current.currentTokens).toEqual([token]);
      expect(result.current.fetchLoading).toBe(false);
      unmount();
    },
  );

  it('waits for recommendations when the all-network holdings snapshot is empty', async () => {
    cacheAllNetworks([]);
    const request = deferred();
    mockFetchTokenList.mockImplementation(async (params) => {
      await request.promise;
      cacheScopedTokens(params, [token]);
    });
    const { result, unmount } = renderList(getNetworkIdsMap().onekeyall);
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalled());
    expect(result.current.currentTokens).toEqual([]);
    expect(result.current.fetchLoading).toBe(true);
    await act(async () => {
      request.resolve();
    });
    expect(result.current.currentTokens).toEqual([token]);
    expect(result.current.fetchLoading).toBe(false);
    unmount();
  });

  it('does not reuse ordinary holdings to finish a new DeFi scope', async () => {
    cacheAllNetworks([token]);
    const request = deferred();
    mockFetchTokenList.mockImplementation(async (params) => {
      await request.promise;
      cacheScopedTokens(params, [token]);
    });
    const { result, rerender, unmount } = renderHook(
      ({ lpToken }) =>
        useSwapTokenList(
          ESwapDirectionType.FROM,
          getNetworkIdsMap().onekeyall,
          undefined,
          ESwapTabSwitchType.SWAP,
          lpToken,
        ),
      { initialProps: { lpToken: false } },
    );
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(1));
    expect(result.current.fetchLoading).toBe(false);
    expect(result.current.currentTokens).toEqual([token]);
    rerender({ lpToken: true });
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(2));
    expect(result.current.fetchLoading).toBe(true);
    expect(result.current.currentTokens).toEqual([]);
    await act(async () => {
      request.resolve();
    });
    expect(result.current.fetchLoading).toBe(false);
    expect(result.current.currentTokens).toEqual([token]);
    unmount();
  });

  it('keeps a successful scoped empty result authoritative during refresh', async () => {
    const request = deferred();
    mockFetchTokenList.mockImplementation(async () => request.promise);
    cacheScopedTokens(
      {
        protocol: ESwapTabSwitchType.SWAP,
        networkId: network.networkId,
        keywords: undefined,
        lpToken: false,
        currency: 'usd',
      },
      [],
    );
    cacheAllNetworks([token]);
    const { result, unmount } = renderList();
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalled());
    expect(result.current.currentTokens).toEqual([]);
    expect(result.current.fetchLoading).toBe(false);
    await act(async () => {
      request.resolve();
    });
    unmount();
  });

  it('keeps usable fallback rows visible throughout a failed refresh', async () => {
    const request = deferred();
    cacheAllNetworks([token]);
    mockFetchTokenList.mockImplementation(async () => request.promise);
    const { result, unmount } = renderList();
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalled());
    expect(result.current.currentTokens).toEqual([token]);
    expect(result.current.fetchLoading).toBe(false);
    await act(async () => {
      request.resolve();
    });
    expect(result.current.currentTokens).toEqual([token]);
    expect(result.current.fetchLoading).toBe(false);
    unmount();
  });

  it('ends cold all-network loading after discovery fails and exposes successful recommendations', async () => {
    const request = deferred();
    mockGetSupportAccounts.mockResolvedValue({
      supportAccountsFetchFailed: true,
      swapSupportAccounts: [],
    });
    mockFetchTokenList.mockImplementation(async (params) => {
      await request.promise;
      cacheScopedTokens(params, [token]);
    });
    const { result, unmount } = renderList(getNetworkIdsMap().onekeyall);
    await waitFor(() => expect(mockLoadAllNetworks).toHaveBeenCalled());
    expect(result.current.fetchLoading).toBe(true);
    await act(async () => {
      request.resolve();
    });
    expect(result.current.fetchLoading).toBe(false);
    expect(result.current.currentTokens).toEqual([token]);
    expect(Object.keys(mockAllNetworkLists)).toEqual([]);
    unmount();

    const retry = deferred();
    mockFetchTokenList.mockImplementation(async () => retry.promise);
    const reopened = renderList(getNetworkIdsMap().onekeyall);
    await waitFor(() =>
      expect(mockGetSupportAccounts).toHaveBeenCalledTimes(2),
    );
    expect(reopened.result.current.fetchLoading).toBe(true);
    await act(async () => {
      retry.resolve();
    });
    expect(reopened.result.current.fetchLoading).toBe(false);
    reopened.unmount();
  });

  it('finishes without creating a fake snapshot when both cold requests fail', async () => {
    const request = deferred();
    mockGetSupportAccounts.mockResolvedValue({
      supportAccountsFetchFailed: true,
      swapSupportAccounts: [],
    });
    mockFetchTokenList.mockImplementation(async () => request.promise);
    const { result, rerender, unmount } = renderList(
      getNetworkIdsMap().onekeyall,
    );
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalled());
    await act(async () => {
      request.resolve();
    });
    expect(result.current.fetchLoading).toBe(false);
    expect(result.current.currentTokens).toEqual([]);
    expect(Object.keys(mockAllNetworkLists)).toEqual([]);

    mockFocused = false;
    rerender();
    const retry = deferred();
    mockFetchTokenList.mockImplementation(async () => retry.promise);
    mockFocused = true;
    rerender();
    expect(result.current.fetchLoading).toBe(true);
    await act(async () => {
      retry.resolve();
    });
    expect(result.current.fetchLoading).toBe(false);
    unmount();
  });

  it('still waits for complete network support metadata after a request settles', async () => {
    mockNetworks = [
      {
        networkId: network.networkId,
        name: network.name,
        symbol: network.symbol,
      },
    ];
    mockFetchTokenList.mockResolvedValue(undefined);
    const { result, rerender, unmount } = renderList(
      getNetworkIdsMap().onekeyall,
    );
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalled());
    expect(result.current.fetchLoading).toBe(true);
    expect(mockLoadAllNetworks).not.toHaveBeenCalled();
    mockNetworks = [network];
    rerender();
    await waitFor(() => expect(mockLoadAllNetworks).toHaveBeenCalled());
    await waitFor(() => expect(result.current.fetchLoading).toBe(false));
    unmount();
  });
});
