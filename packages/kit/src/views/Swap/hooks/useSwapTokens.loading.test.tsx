/** @jest-environment jsdom */

import { Suspense, startTransition } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { buildSwapAllNetworkTokenListCacheKey } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import type {
  IFetchTokensParams,
  ISwapNetwork,
  ISwapToken,
  ISwapTokenCatch,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { buildSwapNetworkReadyKey } from '../utils/swapNetworkCacheUtils';
import {
  buildSwapTokenListCacheKey,
  getSwapTokenSelectorCacheEpoch,
} from '../utils/swapTokenSelectorCacheUtils';

import {
  useSwapSelectedTokenInfo,
  useSwapTokenList,
  useSwapTokenSearchKeyword,
} from './useSwapTokens';

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
const allNetwork: ISwapNetwork = {
  ...network,
  networkId: getNetworkIdsMap().onekeyall,
  name: 'All networks',
  isAllNetworks: true,
};
const solanaNetwork: ISwapNetwork = {
  ...network,
  networkId: 'sol--101',
  name: 'Solana',
  symbol: 'SOL',
};
const solanaContract = '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN';
const token: ISwapToken = {
  networkId: network.networkId,
  contractAddress: '0xtoken',
  decimals: 18,
  symbol: 'TOKEN',
  balanceParsed: '1',
  price: '1',
};
let mockNetworks = [network];
let mockSelectedNetwork: ISwapNetwork | undefined;
let mockDeriveType: string | undefined;
let mockFocused = true;
let mockTokenCatch: Record<string, ISwapTokenCatch> = {};
let mockAllNetworkLists: Record<string, ISwapToken[]> = {};
let mockAllNetworkStatus: Record<string, { identityVersion: number }> = {};
let mockTokenListRequests: Record<string, { identityVersion: number }> = {};
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
const mockFetchTokenList = jest.fn<
  Promise<ISwapToken[] | void>,
  [IFetchTokensParams]
>();
const mockLoadAllNetworks = jest.fn<Promise<void>, unknown[]>();
const mockLoadSelectedToken = jest.fn<Promise<void>, unknown[]>();
let mockRefreshRequested = { from: false, to: false };
const mockSetRefreshRequested = jest.fn(
  (
    update: (
      previous: typeof mockRefreshRequested,
    ) => typeof mockRefreshRequested,
  ) => {
    mockRefreshRequested = update(mockRefreshRequested);
  },
);
let mockBalanceAddressInfo:
  | {
      address?: string;
      networkId: string;
      isAddressInfoReady: boolean;
    }
  | undefined;
const mockActions = {
  tokenListFetchAction: mockFetchTokenList,
  swapLoadAllNetworkTokenList: mockLoadAllNetworks,
  loadSwapSelectTokenDetail: mockLoadSelectedToken,
};
const mockAccountInfo = { indexedAccount: { id: 'loading-test-account' } };
const originalDesktop = platformEnv.isDesktop;
const originalWeb = platformEnv.isWeb;
const originalExtension = platformEnv.isExtension;
let mockGtMd = true;

jest.mock('@onekeyhq/components', () => ({
  useIsOverlayPage: () => false,
  useMedia: () => ({ gtMd: mockGtMd }),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    swap: { tokenSelectorSearch: { swapTokenSelectorSearch: jest.fn() } },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockFocused,
}));
jest.mock('../../../hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('./useSwapAccount', () => ({
  useSwapAddressInfo: (type: ESwapDirectionType) =>
    mockBalanceAddressInfo && type === ESwapDirectionType.FROM
      ? mockBalanceAddressInfo
      : {
          accountInfo: mockAccountInfo,
          deriveType: mockDeriveType,
          ...mockBalanceAddressInfo,
          ...(mockBalanceAddressInfo && type === ESwapDirectionType.TO
            ? { address: 'custom-recipient', networkId: 'sol--101' }
            : {}),
        },
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
  useInAppNotificationAtom: () => [{ swapHistoryPendingList: [] }],
}));
jest.mock('../../../states/jotai/contexts/swap', () => ({
  useSwapActions: () => ({ current: mockActions }),
  useSwapTokenMapAtom: () => [{ tokenCatch: mockTokenCatch }],
  useSwapAllNetworkTokenListMapAtom: () => [mockAllNetworkLists],
  useSwapAllNetworkTokenListStatusAtom: () => [mockAllNetworkStatus],
  useSwapNetworksAtom: () => [mockNetworks],
  useSwapNetworksIncludeAllNetworkAtom: () => [mockNetworks],
  useSwapSelectTokenNetworkAtom: () => [mockSelectedNetwork],
  useSwapSelectedTokenBalanceRefreshRequestedAtom: () => [
    mockRefreshRequested,
    mockSetRefreshRequested,
  ],
  useSwapTokenListRequestsAtom: () => [mockTokenListRequests],
}));

describe('useSwapSelectedTokenInfo requested refresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockFocused = true;
    mockSelectedNetwork = undefined;
    mockRefreshRequested = { from: false, to: false };
    mockBalanceAddressInfo = {
      address: 'current-from-wallet',
      networkId: 'evm--1',
      isAddressInfoReady: true,
    };
    mockLoadSelectedToken.mockResolvedValue(undefined);
  });
  afterEach(() => {
    mockBalanceAddressInfo = undefined;
    jest.useRealTimers();
  });

  it('forces only the two selected tokens using the FROM wallet for both directions', () => {
    mockRefreshRequested = { from: true, to: true };
    renderHook(() => {
      useSwapSelectedTokenInfo({ type: ESwapDirectionType.FROM, token });
      useSwapSelectedTokenInfo({
        type: ESwapDirectionType.TO,
        token: {
          ...token,
          networkId: 'sol--101',
          contractAddress: solanaContract,
        },
      });
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockLoadSelectedToken).toHaveBeenCalledTimes(2);
    for (const direction of [ESwapDirectionType.FROM, ESwapDirectionType.TO]) {
      expect(mockLoadSelectedToken).toHaveBeenCalledWith(
        direction,
        expect.objectContaining({
          address: 'current-from-wallet',
          networkId: 'evm--1',
        }),
        true,
      );
    }
    expect(mockRefreshRequested).toEqual({ from: false, to: false });
    expect(mockLoadAllNetworks).not.toHaveBeenCalled();
  });

  it('retains forced refresh through selector browsing, unresolved address and ordinary debounce replacement', () => {
    mockRefreshRequested = { from: true, to: false };
    mockSelectedNetwork = solanaNetwork;
    const { rerender } = renderHook(() =>
      useSwapSelectedTokenInfo({ type: ESwapDirectionType.FROM, token }),
    );
    act(() => {
      jest.advanceTimersByTime(300);
    });
    // Ordinary loads still run; only the forced balance waits.
    expect(mockLoadSelectedToken).toHaveBeenLastCalledWith(
      ESwapDirectionType.FROM,
      expect.anything(),
      false,
    );
    expect(mockRefreshRequested.from).toBe(true);

    mockSelectedNetwork = undefined;
    mockBalanceAddressInfo = { networkId: 'evm--1', isAddressInfoReady: false };
    rerender();
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockLoadSelectedToken).toHaveBeenLastCalledWith(
      ESwapDirectionType.FROM,
      expect.anything(),
      false,
    );
    expect(mockRefreshRequested.from).toBe(true);
    mockLoadSelectedToken.mockClear();

    mockBalanceAddressInfo = {
      address: 'latest-wallet',
      networkId: 'evm--1',
      isAddressInfoReady: true,
    };
    rerender();
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockLoadSelectedToken).toHaveBeenCalledTimes(1);
    expect(mockLoadSelectedToken).toHaveBeenCalledWith(
      ESwapDirectionType.FROM,
      expect.objectContaining({ address: 'latest-wallet' }),
      true,
    );
    expect(mockRefreshRequested.from).toBe(false);
    rerender();
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockLoadSelectedToken).toHaveBeenCalledTimes(1);
  });

  it('keeps loading TO details and drops the request when the FROM wallet has no address', () => {
    mockRefreshRequested = { from: false, to: true };
    mockBalanceAddressInfo = { networkId: 'evm--1', isAddressInfoReady: true };
    const { rerender } = renderHook(
      ({ selected }: { selected: ISwapToken }) =>
        useSwapSelectedTokenInfo({
          type: ESwapDirectionType.TO,
          token: selected,
        }),
      { initialProps: { selected: token } },
    );
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockLoadSelectedToken).toHaveBeenCalledTimes(1);
    expect(mockLoadSelectedToken).toHaveBeenCalledWith(
      ESwapDirectionType.TO,
      expect.objectContaining({ isAddressInfoReady: true }),
      false,
    );
    expect(mockRefreshRequested.to).toBe(false);

    // Later ordinary loads (a token change) are not held back either.
    rerender({
      selected: {
        ...token,
        networkId: 'sol--101',
        contractAddress: solanaContract,
      },
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockLoadSelectedToken).toHaveBeenCalledTimes(2);
  });

  it('does not retain a forced flag in debounce after the refresh intent is cancelled', () => {
    mockRefreshRequested = { from: true, to: false };
    const { rerender } = renderHook(() =>
      useSwapSelectedTokenInfo({ type: ESwapDirectionType.FROM, token }),
    );
    mockRefreshRequested = { from: false, to: false };
    rerender();
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockLoadSelectedToken).toHaveBeenCalledTimes(1);
    expect(mockLoadSelectedToken.mock.calls[0][2]).toBe(false);
  });

  it('keeps an undispatched refresh through unmount and consumes it on return', () => {
    mockRefreshRequested = { from: true, to: false };
    const first = renderHook(() =>
      useSwapSelectedTokenInfo({ type: ESwapDirectionType.FROM, token }),
    );
    first.unmount();
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockLoadSelectedToken).not.toHaveBeenCalled();
    expect(mockRefreshRequested.from).toBe(true);

    renderHook(() =>
      useSwapSelectedTokenInfo({ type: ESwapDirectionType.FROM, token }),
    );
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockLoadSelectedToken).toHaveBeenCalledTimes(1);
    expect(mockLoadSelectedToken.mock.calls[0][2]).toBe(true);
  });
});

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function cacheAllNetworks(
  tokens: ISwapToken[],
  protocol = ESwapTabSwitchType.SWAP,
) {
  const key = buildSwapAllNetworkTokenListCacheKey({
    accountId: mockAccountInfo.indexedAccount.id,
    lpToken: false,
    currency: 'usd',
    protocol,
  });
  mockAllNetworkLists = {
    [key]: tokens,
  };
  mockAllNetworkStatus = {
    [key]: { identityVersion: getSwapTokenSelectorCacheEpoch().identity },
  };
}

function cacheScopedTokens(params: IFetchTokensParams, tokens: ISwapToken[]) {
  mockTokenCatch = {
    ...mockTokenCatch,
    [buildSwapTokenListCacheKey(params)]: {
      data: tokens,
      updatedAt: Date.now(),
      refreshVersion: getSwapTokenSelectorCacheEpoch().refresh,
      identityVersion: getSwapTokenSelectorCacheEpoch().identity,
    },
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

function renderSearchList(keywords = '', searchRound = 0) {
  return renderHook(
    ({ query, round }) =>
      useSwapTokenList(
        ESwapDirectionType.FROM,
        network.networkId,
        query,
        ESwapTabSwitchType.SWAP,
        false,
        undefined,
        undefined,
        round,
      ),
    { initialProps: { query: keywords, round: searchRound } },
  );
}

function renderNetworkSearch(query: string, pending = false) {
  mockNetworks = [allNetwork, network, solanaNetwork];
  mockSelectedNetwork = allNetwork;
  return renderHook(
    ({ networkId, isPending }) =>
      useSwapTokenList(
        ESwapDirectionType.FROM,
        networkId,
        query,
        ESwapTabSwitchType.SWAP,
        false,
        undefined,
        undefined,
        1,
        isPending,
      ),
    { initialProps: { networkId: allNetwork.networkId, isPending: pending } },
  );
}

function getDisplayedTokens(result: ReturnType<typeof useSwapTokenList>) {
  return result.currentTokens.map((item) =>
    'item' in item ? item.item : item,
  );
}

describe('useSwapTokenList loading lifecycle', () => {
  beforeEach(() => {
    platformEnv.isExtension = false;
    mockGtMd = true;
    appEventBus.emit(EAppEventBusNames.GlobalDeriveTypeUpdate, {
      networkImpl: 'evm',
    });
    jest.clearAllMocks();
    mockNetworks = [network];
    mockSelectedNetwork = undefined;
    mockDeriveType = undefined;
    mockFocused = true;
    mockTokenCatch = {};
    mockAllNetworkLists = {};
    mockAllNetworkStatus = {};
    mockTokenListRequests = {};
    mockFetchTokenList.mockReset();
    mockFetchTokenList.mockResolvedValue(undefined);
    mockGetSupportAccounts.mockResolvedValue({
      supportAccountsFetchFailed: false,
      swapSupportAccounts: [],
    });
    mockLoadAllNetworks.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    platformEnv.isDesktop = originalDesktop;
    platformEnv.isWeb = originalWeb;
    platformEnv.isExtension = originalExtension;
  });

  it.each([
    { platform: 'desktop', query: '', allNetworks: false },
    { platform: 'web', query: '', allNetworks: true },
    { platform: 'desktop', query: 'TOKEN', allNetworks: false },
    { platform: 'web', query: 'TOKEN', allNetworks: true },
  ])(
    'loads basic-ready $platform tokens without DeFi metadata (query=$query, all=$allNetworks)',
    async ({ platform, query, allNetworks }) => {
      platformEnv.isDesktop = platform === 'desktop';
      platformEnv.isWeb = platform === 'web';
      mockNetworks = [{ ...network, isDeFiEnabled: undefined }];
      mockFetchTokenList.mockImplementation(async (params) => {
        if (!params.keywords) cacheScopedTokens(params, [token]);
        return [token];
      });
      const { result, unmount } = renderHook(() =>
        useSwapTokenList(
          ESwapDirectionType.FROM,
          allNetworks ? getNetworkIdsMap().onekeyall : network.networkId,
          query,
          ESwapTabSwitchType.SWAP,
          false,
        ),
      );
      await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(result.current.fetchLoading).toBe(false));
      expect(getDisplayedTokens(result.current)).toEqual([token]);
      unmount();
    },
  );

  it('waits for DeFi metadata only when the DeFi filter is requested', async () => {
    platformEnv.isDesktop = true;
    mockNetworks = [{ ...network, isDeFiEnabled: undefined }];
    const { rerender, unmount } = renderHook(() =>
      useSwapTokenList(
        ESwapDirectionType.FROM,
        network.networkId,
        undefined,
        ESwapTabSwitchType.SWAP,
        true,
      ),
    );
    await waitFor(() => expect(mockGetSupportAccounts).toHaveBeenCalled());
    expect(mockFetchTokenList).not.toHaveBeenCalled();
    mockNetworks = [network];
    rerender();
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalled());
    unmount();
  });

  it.each([
    { platform: 'desktop', isDesktop: true, isWeb: false },
    { platform: 'web', isDesktop: false, isWeb: true },
    { platform: 'wide extension', isDesktop: false, isWeb: false },
  ])(
    'keeps the $platform skeleton when the full chain snapshot was evicted but aggregate holdings remain',
    async ({ isDesktop, isWeb }) => {
      platformEnv.isDesktop = isDesktop;
      platformEnv.isWeb = isWeb;
      platformEnv.isExtension = !isDesktop && !isWeb;
      cacheAllNetworks([token]);
      // Other chain snapshots can outlive the selected chain's LRU entry.
      cacheScopedTokens(
        {
          networkId: 'evm--56',
          protocol: ESwapTabSwitchType.SWAP,
          currency: 'usd',
          lpToken: false,
        },
        [],
      );
      const request = deferred();
      const completeList = [
        token,
        { ...token, contractAddress: '0xrecommended', balanceParsed: '0' },
      ];
      mockFetchTokenList.mockImplementation(async (params) => {
        await request.promise;
        cacheScopedTokens(params, completeList);
        return completeList;
      });
      const { result, unmount } = renderList();
      await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(1));
      expect(result.current.currentTokens).toEqual([]);
      expect(result.current.fetchLoading).toBe(true);
      await act(async () => {
        request.resolve();
      });
      expect(result.current.currentTokens).toEqual(completeList);
      expect(result.current.fetchLoading).toBe(false);
      unmount();
    },
  );

  it.each([
    { platform: 'desktop', isDesktop: true, isWeb: false },
    { platform: 'web', isDesktop: false, isWeb: true },
    { platform: 'wide extension', isDesktop: false, isWeb: false },
  ])(
    'does not promote aggregate holdings to a full $platform snapshot after a failed request',
    async ({ isDesktop, isWeb }) => {
      platformEnv.isDesktop = isDesktop;
      platformEnv.isWeb = isWeb;
      platformEnv.isExtension = !isDesktop && !isWeb;
      cacheAllNetworks([token]);
      const request = deferred();
      mockFetchTokenList.mockImplementation(async () => {
        await request.promise;
        throw new OneKeyLocalError('chain request failed');
      });
      const { result, rerender, unmount } = renderList();
      await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(1));
      expect(result.current.currentTokens).toEqual([]);
      expect(result.current.fetchLoading).toBe(true);
      await act(async () => {
        request.resolve();
      });
      expect(result.current.currentTokens).toEqual([]);
      expect(result.current.fetchLoading).toBe(false);
      expect(mockTokenCatch).toEqual({});
      rerender();
      expect(result.current.currentTokens).toEqual([]);
      expect(mockFetchTokenList).toHaveBeenCalledTimes(1);
      unmount();
    },
  );

  it.each([
    { platform: 'native', isDesktop: false, protocol: ESwapTabSwitchType.SWAP },
    {
      platform: 'desktop Stock',
      isDesktop: true,
      protocol: ESwapTabSwitchType.STOCK,
    },
  ])(
    'preserves the existing $platform holdings fallback',
    async ({ isDesktop, protocol }) => {
      platformEnv.isDesktop = isDesktop;
      platformEnv.isWeb = false;
      cacheAllNetworks([token], protocol);
      const request = deferred();
      mockFetchTokenList.mockImplementation(async () => request.promise);
      const { result, unmount } = renderHook(() =>
        useSwapTokenList(
          ESwapDirectionType.FROM,
          network.networkId,
          undefined,
          protocol,
          false,
        ),
      );
      await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(1));
      expect(result.current.currentTokens).toEqual([token]);
      expect(result.current.fetchLoading).toBe(false);
      await act(async () => {
        request.resolve();
      });
      expect(result.current.currentTokens).toEqual([token]);
      unmount();
    },
  );

  it.each([
    {
      platform: 'wide extension',
      extension: true,
      gtMd: true,
      protocol: ESwapTabSwitchType.SWAP,
      expected: 1,
    },
    {
      platform: 'narrow extension',
      extension: true,
      gtMd: false,
      protocol: ESwapTabSwitchType.SWAP,
      expected: 0,
    },
    {
      platform: 'extension stock',
      extension: true,
      gtMd: true,
      protocol: ESwapTabSwitchType.STOCK,
      expected: 0,
    },
    {
      platform: 'native',
      extension: false,
      gtMd: true,
      protocol: ESwapTabSwitchType.SWAP,
      expected: 0,
    },
  ])(
    'refreshes the concrete-chain wallet only for $platform wide ordinary selection',
    async ({ extension, gtMd, protocol, expected }) => {
      platformEnv.isDesktop = false;
      platformEnv.isWeb = false;
      platformEnv.isExtension = extension;
      mockGtMd = gtMd;
      mockFetchTokenList.mockImplementation(async (params) => {
        cacheScopedTokens(params, [token]);
        return [token];
      });
      const { result, unmount } = renderHook(() =>
        useSwapTokenList(
          ESwapDirectionType.FROM,
          network.networkId,
          undefined,
          protocol,
          false,
        ),
      );
      await waitFor(() => expect(result.current.fetchLoading).toBe(false));
      expect(mockLoadAllNetworks).toHaveBeenCalledTimes(expected);
      unmount();
    },
  );

  it('replaces a warm wide-extension chain snapshot through the wallet refresh', async () => {
    platformEnv.isDesktop = false;
    platformEnv.isWeb = false;
    platformEnv.isExtension = true;
    const account: IAllNetworkAccountInfo = {
      networkId: network.networkId,
      accountId: 'wide-account',
      apiAddress: '0xwide',
      accountXpub: undefined,
      pub: undefined,
      dbAccount: undefined,
      isNftEnabled: true,
      isBackendIndexed: true,
      deriveType: undefined,
      deriveInfo: undefined,
      isTestnet: false,
    };
    mockGetSupportAccounts.mockResolvedValue({
      supportAccountsFetchFailed: false,
      swapSupportAccounts: [account],
    });
    const params: IFetchTokensParams = {
      networkId: network.networkId,
      accountNetworkId: account.networkId,
      accountAddress: account.apiAddress,
      accountId: account.accountId,
      protocol: ESwapTabSwitchType.SWAP,
      lpToken: false,
      currency: 'usd',
    };
    cacheScopedTokens(params, [token]);
    const refresh = deferred();
    const updated = { ...token, balanceParsed: '2' };
    mockLoadAllNetworks.mockImplementationOnce(async () => {
      await refresh.promise;
      cacheScopedTokens(params, [updated]);
    });
    const { result, unmount } = renderList();
    await waitFor(() => expect(result.current.currentTokens).toEqual([token]));
    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(1);
    expect(mockFetchTokenList).not.toHaveBeenCalled();
    await act(async () => refresh.resolve());
    expect(result.current.currentTokens).toEqual([updated]);
    unmount();
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
    await waitFor(() => {
      expect(mockGetSupportAccounts).toHaveBeenCalledTimes(2);
      expect(mockFetchTokenList).toHaveBeenCalledTimes(2);
    });
    expect(reopened.result.current.fetchLoading).toBe(true);
    await act(async () => {
      retry.resolve();
    });
    await waitFor(() => {
      expect(reopened.result.current.fetchLoading).toBe(false);
    });
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

  it('does not restart the same request when cached account discovery returns equivalent objects', async () => {
    const firstOpen = renderList();
    await waitFor(() =>
      expect(firstOpen.result.current.fetchLoading).toBe(false),
    );
    firstOpen.unmount();

    mockFetchTokenList.mockClear();
    const discovery = deferred();
    const request = deferred();
    mockGetSupportAccounts.mockImplementation(async () => {
      await discovery.promise;
      return { supportAccountsFetchFailed: false, swapSupportAccounts: [] };
    });
    mockFetchTokenList.mockImplementation(async (params) => {
      await request.promise;
      cacheScopedTokens(params, [token]);
    });

    const { result, unmount } = renderList();
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(1));
    await act(async () => {
      discovery.resolve();
    });
    expect(mockFetchTokenList).toHaveBeenCalledTimes(1);
    await act(async () => {
      request.resolve();
    });
    expect(result.current.currentTokens).toEqual([token]);
    expect(result.current.fetchLoading).toBe(false);
    unmount();
  });

  it('immediately reuses A after A → B → A while the B request is pending', async () => {
    const chainB = 'evm--42161';
    const requestB = deferred();
    const paramsA = {
      protocol: ESwapTabSwitchType.SWAP,
      networkId: network.networkId,
      lpToken: false,
      currency: 'usd',
    };
    cacheScopedTokens(paramsA, [token]);
    mockFetchTokenList.mockImplementation(async (params) => {
      if (params.networkId === chainB) {
        await requestB.promise;
      }
    });
    const { result, rerender, unmount } = renderHook(
      ({ networkId }) =>
        useSwapTokenList(
          ESwapDirectionType.FROM,
          networkId,
          undefined,
          ESwapTabSwitchType.SWAP,
          false,
        ),
      { initialProps: { networkId: network.networkId } },
    );
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(1));
    expect(result.current.currentTokens).toEqual([token]);

    mockTokenListRequests = {
      [buildSwapTokenListCacheKey({ ...paramsA, networkId: chainB })]: {
        identityVersion: getSwapTokenSelectorCacheEpoch().identity,
      },
    };
    rerender({ networkId: chainB });
    expect(result.current.currentTokens).toEqual([]);
    expect(result.current.fetchLoading).toBe(true);
    rerender({ networkId: network.networkId });
    expect(result.current.currentTokens).toEqual([token]);
    expect(result.current.fetchLoading).toBe(false);

    await act(async () => {
      requestB.resolve();
    });
    expect(result.current.currentTokens).toEqual([token]);
    expect(result.current.fetchLoading).toBe(false);
    unmount();
  });

  it('does not restart the committed request after a different chain render is suspended', async () => {
    const suspendedRender = deferred();
    const { result, rerender, unmount } = renderHook(
      ({ networkId, suspend }) => {
        const list = useSwapTokenList(
          ESwapDirectionType.FROM,
          networkId,
          undefined,
          ESwapTabSwitchType.SWAP,
          false,
        );
        if (suspend) {
          throw suspendedRender.promise;
        }
        return list;
      },
      {
        initialProps: { networkId: network.networkId, suspend: false },
        wrapper: ({ children }) => (
          <Suspense fallback={null}>{children}</Suspense>
        ),
      },
    );
    await waitFor(() => expect(result.current.fetchLoading).toBe(false));
    expect(mockFetchTokenList).toHaveBeenCalledTimes(1);
    act(() => {
      startTransition(() => {
        rerender({ networkId: 'evm--42161', suspend: true });
      });
    });
    rerender({ networkId: network.networkId, suspend: false });
    expect(mockFetchTokenList).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('ignores another chain request when the current request has settled without data', async () => {
    mockTokenListRequests = {
      [buildSwapTokenListCacheKey({ networkId: 'evm--42161' })]: {
        identityVersion: getSwapTokenSelectorCacheEpoch().identity,
      },
    };
    const { result, unmount } = renderList();
    await waitFor(() => expect(result.current.fetchLoading).toBe(false));
    expect(result.current.currentTokens).toEqual([]);
    unmount();
  });

  it('refreshes once for a swap event while retaining the displayed snapshot', async () => {
    mockFetchTokenList.mockImplementation(async (params) => {
      cacheScopedTokens(params, [token]);
    });
    const { result, unmount } = renderList();
    await waitFor(() => expect(result.current.currentTokens).toEqual([token]));
    expect(mockFetchTokenList).toHaveBeenCalledTimes(1);
    const refresh = deferred();
    mockFetchTokenList.mockImplementation(async () => refresh.promise);
    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
        status: ESwapTxHistoryStatus.SUCCESS,
      });
    });
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(2));
    expect(result.current.currentTokens).toEqual([token]);
    expect(result.current.fetchLoading).toBe(false);
    await act(async () => {
      refresh.resolve();
    });
    expect(mockFetchTokenList).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('does not reuse a cleared wallet address while account discovery is pending', async () => {
    const account: IAllNetworkAccountInfo = {
      networkId: network.networkId,
      accountId: 'cleared-account',
      apiAddress: '0x1234567890123456789012345678901234567890',
      accountXpub: undefined,
      pub: undefined,
      dbAccount: undefined,
      isNftEnabled: true,
      isBackendIndexed: true,
      deriveType: undefined,
      deriveInfo: undefined,
      isTestnet: false,
    };
    mockGetSupportAccounts.mockResolvedValue({
      supportAccountsFetchFailed: false,
      swapSupportAccounts: [account],
    });
    mockFetchTokenList.mockImplementation(async (params) => {
      cacheScopedTokens(params, [token]);
    });
    const { result, unmount } = renderList();
    await waitFor(() => expect(result.current.currentTokens).toEqual([token]));

    const discovery = deferred();
    mockGetSupportAccounts.mockImplementation(async () => {
      await discovery.promise;
      return { supportAccountsFetchFailed: false, swapSupportAccounts: [] };
    });
    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletClear, undefined);
    });
    expect(result.current.currentTokens).toEqual([]);
    expect(result.current.fetchLoading).toBe(true);
    expect(mockFetchTokenList).toHaveBeenCalledTimes(1);

    await act(async () => {
      discovery.resolve();
    });
    expect(mockFetchTokenList).toHaveBeenCalledTimes(2);
    expect(mockFetchTokenList.mock.calls[1][0].accountAddress).toBeUndefined();
    unmount();
  });

  it('keeps ordinary tokens when a prior DeFi request completes after switching back', async () => {
    const lpToken: ISwapToken = {
      ...token,
      contractAddress: '0xlptoken',
      symbol: 'LP',
    };
    const lpRequest = deferred();
    mockFetchTokenList.mockImplementation(async (params) => {
      if (params.lpToken) {
        await lpRequest.promise;
        cacheScopedTokens(params, [lpToken]);
      } else {
        cacheScopedTokens(params, [token]);
      }
    });
    const { result, rerender, unmount } = renderHook(
      ({ lpOnly }) =>
        useSwapTokenList(
          ESwapDirectionType.FROM,
          network.networkId,
          undefined,
          ESwapTabSwitchType.SWAP,
          lpOnly,
        ),
      { initialProps: { lpOnly: false } },
    );
    await waitFor(() => expect(result.current.currentTokens).toEqual([token]));
    rerender({ lpOnly: true });
    expect(result.current.currentTokens).toEqual([]);
    expect(result.current.fetchLoading).toBe(true);
    rerender({ lpOnly: false });
    expect(result.current.currentTokens).toEqual([token]);
    expect(result.current.fetchLoading).toBe(false);
    await act(async () => {
      lpRequest.resolve();
    });
    expect(result.current.currentTokens).toEqual([token]);
    expect(result.current.fetchLoading).toBe(false);
    unmount();
  });

  it.each([
    { query: 'TOKEN', firstTokens: [token] },
    {
      query: '0x1234567890123456789012345678901234567890',
      firstTokens: [token],
    },
    { query: 'missing', firstTokens: [] },
  ])(
    'requests a new $query search after clearing a completed result',
    async ({ query, firstTokens }) => {
      mockFetchTokenList.mockResolvedValue(firstTokens);
      const { result, rerender, unmount } = renderSearchList(query, 1);
      await waitFor(() => expect(result.current.fetchLoading).toBe(false));
      expect(getDisplayedTokens(result.current)).toEqual(firstTokens);
      expect(mockTokenCatch).toEqual({});

      rerender({ query: '', round: 2 });
      const nextSearch = deferred();
      const nextToken = { ...token, symbol: 'UPDATED' };
      mockFetchTokenList.mockImplementation(async () => {
        await nextSearch.promise;
        return [nextToken];
      });
      rerender({ query, round: 3 });
      expect(result.current.currentTokens).toEqual([]);
      expect(result.current.fetchLoading).toBe(true);
      expect(
        mockFetchTokenList.mock.calls.filter(
          ([params]) => params.keywords === query,
        ),
      ).toHaveLength(2);
      await act(async () => {
        nextSearch.resolve();
      });
      expect(getDisplayedTokens(result.current)).toEqual([nextToken]);
      expect(result.current.fetchLoading).toBe(false);
      unmount();
    },
  );

  it('refreshes completed contract searches on network changes even with the same HTTP identity', async () => {
    mockFetchTokenList.mockResolvedValue([]);
    const { result, rerender, unmount } = renderNetworkSearch(solanaContract);
    await waitFor(() => expect(result.current.fetchLoading).toBe(false));
    expect(mockFetchTokenList).toHaveBeenCalledTimes(1);
    const refresh = deferred();
    mockFetchTokenList.mockImplementationOnce(async () => {
      await refresh.promise;
      return [];
    });
    mockSelectedNetwork = solanaNetwork;
    rerender({ networkId: solanaNetwork.networkId, isPending: false });
    expect(result.current.fetchLoading).toBe(true);
    expect(result.current.currentTokens).toEqual([]);
    expect(mockFetchTokenList).toHaveBeenCalledTimes(2);
    await act(async () => refresh.resolve());
    expect(result.current.fetchLoading).toBe(false);

    mockSelectedNetwork = network;
    rerender({ networkId: network.networkId, isPending: false });
    await waitFor(() => expect(result.current.fetchLoading).toBe(false));
    expect(mockFetchTokenList).toHaveBeenCalledTimes(3);
    mockSelectedNetwork = allNetwork;
    rerender({ networkId: allNetwork.networkId, isPending: false });
    await waitFor(() => expect(result.current.fetchLoading).toBe(false));
    expect(mockFetchTokenList).toHaveBeenCalledTimes(4);
    expect(
      new Set(
        mockFetchTokenList.mock.calls.map(([params]) =>
          buildSwapTokenListCacheKey(params),
        ),
      ).size,
    ).toBe(1);
    mockSelectedNetwork = { ...allNetwork };
    rerender({ networkId: allNetwork.networkId, isPending: false });
    expect(mockFetchTokenList).toHaveBeenCalledTimes(4);
    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('resubscribes to the same pending search after switching networks and back', async () => {
    const request = deferred();
    const searchedToken = { ...token, contractAddress: solanaContract };
    mockFetchTokenList.mockImplementation(async () => {
      await request.promise;
      return [searchedToken];
    });
    const { result, rerender, unmount } = renderNetworkSearch(solanaContract);
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(1));
    mockSelectedNetwork = solanaNetwork;
    rerender({ networkId: solanaNetwork.networkId, isPending: false });
    mockSelectedNetwork = allNetwork;
    rerender({ networkId: allNetwork.networkId, isPending: false });
    expect(mockFetchTokenList).toHaveBeenCalledTimes(3);
    expect(result.current.fetchLoading).toBe(true);
    expect(
      new Set(
        mockFetchTokenList.mock.calls.map(([params]) =>
          buildSwapTokenListCacheKey(params),
        ),
      ).size,
    ).toBe(1);
    await act(async () => request.resolve());
    expect(getDisplayedTokens(result.current)).toEqual([searchedToken]);
    expect(result.current.fetchLoading).toBe(false);
    expect(mockLoadAllNetworks).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('keeps text debounce pending across network changes before starting the search', async () => {
    mockFetchTokenList.mockResolvedValue([]);
    const { result, rerender, unmount } = renderNetworkSearch(
      solanaContract,
      true,
    );
    await waitFor(() =>
      expect(mockGetSupportAccounts).toHaveBeenCalledTimes(1),
    );
    mockSelectedNetwork = solanaNetwork;
    rerender({ networkId: solanaNetwork.networkId, isPending: true });
    expect(mockFetchTokenList).not.toHaveBeenCalled();
    rerender({ networkId: solanaNetwork.networkId, isPending: false });
    await waitFor(() => expect(result.current.fetchLoading).toBe(false));
    expect(mockFetchTokenList).toHaveBeenCalledTimes(1);
    expect(mockFetchTokenList.mock.calls[0][0]).toMatchObject({
      networkId: allNetwork.networkId,
      keywords: solanaContract,
    });
    unmount();
  });

  it('ignores a previous network response that finishes after the new symbol search', async () => {
    const previousRequest = deferred();
    const currentRequest = deferred();
    const currentToken = { ...token, networkId: solanaNetwork.networkId };
    mockFetchTokenList.mockImplementation(async (params) => {
      if (params.networkId === allNetwork.networkId) {
        await previousRequest.promise;
        return [token];
      }
      await currentRequest.promise;
      return [currentToken];
    });
    const { result, rerender, unmount } = renderNetworkSearch('TOKEN');
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(1));
    mockSelectedNetwork = solanaNetwork;
    rerender({ networkId: solanaNetwork.networkId, isPending: false });
    expect(result.current.fetchLoading).toBe(true);
    await act(async () => currentRequest.resolve());
    expect(getDisplayedTokens(result.current)).toEqual([currentToken]);
    await act(async () => previousRequest.resolve());
    expect(getDisplayedTokens(result.current)).toEqual([currentToken]);
    expect(result.current.fetchLoading).toBe(false);
    unmount();
  });

  it('does not read an old completed search snapshot or refetch on an equivalent render', async () => {
    cacheScopedTokens(
      {
        networkId: network.networkId,
        protocol: ESwapTabSwitchType.SWAP,
        keywords: 'TOKEN',
        onlySwapTokens: true,
        currency: 'usd',
        lpToken: false,
      },
      [token],
    );
    const request = deferred();
    const updatedToken = { ...token, balanceParsed: '2' };
    mockFetchTokenList.mockImplementation(async () => {
      await request.promise;
      return [updatedToken];
    });
    const { result, rerender, unmount } = renderSearchList('TOKEN', 1);
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(1));
    expect(result.current.currentTokens).toEqual([]);
    expect(result.current.fetchLoading).toBe(true);
    await act(async () => {
      request.resolve();
    });
    expect(getDisplayedTokens(result.current)).toEqual([updatedToken]);
    mockNetworks = [{ ...network }];
    rerender({ query: 'TOKEN', round: 1 });
    expect(mockFetchTokenList).toHaveBeenCalledTimes(1);
    expect(getDisplayedTokens(result.current)).toEqual([updatedToken]);
    unmount();
  });

  it('waits for the new search round to settle even when its debounced text matches the previous round', async () => {
    mockFetchTokenList.mockResolvedValue([token]);
    const { result, rerender, unmount } = renderHook(
      ({ pending, round }) =>
        useSwapTokenList(
          ESwapDirectionType.FROM,
          network.networkId,
          'TOKEN',
          ESwapTabSwitchType.SWAP,
          false,
          undefined,
          undefined,
          round,
          pending,
        ),
      { initialProps: { pending: true, round: 1 } },
    );
    await waitFor(() =>
      expect(mockGetSupportAccounts).toHaveBeenCalledTimes(1),
    );
    expect(mockFetchTokenList).not.toHaveBeenCalled();
    rerender({ pending: false, round: 1 });
    await waitFor(() => expect(result.current.fetchLoading).toBe(false));
    expect(mockFetchTokenList).toHaveBeenCalledTimes(1);
    rerender({ pending: true, round: 2 });
    expect(result.current.currentTokens).toEqual([]);
    expect(mockFetchTokenList).toHaveBeenCalledTimes(1);
    rerender({ pending: false, round: 2 });
    await waitFor(() => expect(result.current.fetchLoading).toBe(false));
    expect(mockFetchTokenList).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('ignores a late response from another search round', async () => {
    const requestA = deferred();
    const requestB = deferred();
    const tokenA = { ...token, symbol: 'A' };
    const tokenB = { ...token, symbol: 'B' };
    mockFetchTokenList.mockImplementation(async (params) => {
      await (params.keywords === 'A' ? requestA.promise : requestB.promise);
      return params.keywords === 'A' ? [tokenA] : [tokenB];
    });
    const { result, rerender, unmount } = renderSearchList('A', 1);
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(1));
    rerender({ query: 'B', round: 2 });
    await act(async () => {
      requestB.resolve();
    });
    expect(getDisplayedTokens(result.current)).toEqual([tokenB]);
    await act(async () => {
      requestA.resolve();
    });
    expect(getDisplayedTokens(result.current)).toEqual([tokenB]);
    expect(result.current.fetchLoading).toBe(false);
    unmount();
  });

  it('publishes contract search results before a slower all-network refresh finishes', async () => {
    const balanceRefresh = deferred();
    const searchRequest = deferred();
    mockLoadAllNetworks.mockReturnValue(balanceRefresh.promise);
    mockFetchTokenList.mockImplementation(async () => {
      await searchRequest.promise;
      return [token];
    });
    const { result, unmount } = renderHook(() =>
      useSwapTokenList(
        ESwapDirectionType.FROM,
        getNetworkIdsMap().onekeyall,
        '0x1234567890123456789012345678901234567890',
        ESwapTabSwitchType.SWAP,
        false,
      ),
    );
    await waitFor(() => expect(mockLoadAllNetworks).toHaveBeenCalledTimes(1));
    await act(async () => {
      searchRequest.resolve();
    });
    expect(getDisplayedTokens(result.current)).toEqual([token]);
    expect(result.current.fetchLoading).toBe(false);
    await act(async () => {
      balanceRefresh.resolve();
    });
    unmount();
  });

  it('discards a pending search response after the wallet identity changes', async () => {
    const oldRequest = deferred();
    const newRequest = deferred();
    mockFetchTokenList
      .mockImplementationOnce(async () => {
        await oldRequest.promise;
        return [token];
      })
      .mockImplementation(async () => {
        await newRequest.promise;
        return [];
      });
    const { result, unmount } = renderSearchList('TOKEN', 1);
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(1));
    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletClear, undefined);
    });
    await waitFor(() => expect(mockFetchTokenList).toHaveBeenCalledTimes(2));
    await act(async () => {
      oldRequest.resolve();
    });
    expect(result.current.currentTokens).toEqual([]);
    expect(result.current.fetchLoading).toBe(true);
    await act(async () => {
      newRequest.resolve();
    });
    expect(result.current.fetchLoading).toBe(false);
    unmount();
  });

  it('preserves cached rows when network order and the selected chain derive resolve', async () => {
    const solana = {
      ...network,
      networkId: 'sol--101',
      name: 'Solana',
      symbol: 'SOL',
    };
    mockNetworks = [network, solana];
    cacheAllNetworks([token]);
    const { result, rerender, unmount } = renderList();
    await waitFor(() => expect(result.current.currentTokens).toEqual([token]));
    const discoveryCalls = mockGetSupportAccounts.mock.calls.length;
    const request = deferred();
    mockGetSupportAccounts.mockImplementation(async () => {
      await request.promise;
      return { supportAccountsFetchFailed: false, swapSupportAccounts: [] };
    });
    mockNetworks = [solana, network];
    mockDeriveType = 'default';
    rerender();
    expect(result.current.currentTokens).toEqual([token]);
    expect(result.current.fetchLoading).toBe(false);
    expect(mockGetSupportAccounts).toHaveBeenCalledTimes(discoveryCalls);
    expect(buildSwapNetworkReadyKey([network, solana])).toBe(
      buildSwapNetworkReadyKey([solana, network]),
    );

    mockFetchTokenList.mockImplementation(async (params) => {
      cacheScopedTokens(params, [token]);
    });

    act(() => {
      appEventBus.emit(EAppEventBusNames.GlobalDeriveTypeUpdate, {
        networkImpl: 'btc',
      });
    });
    expect(result.current.currentTokens).toEqual([]);
    expect(result.current.fetchLoading).toBe(true);
    expect(mockGetSupportAccounts).toHaveBeenCalledTimes(discoveryCalls + 1);
    await act(async () => {
      request.resolve();
    });
    expect(result.current.currentTokens).toEqual([token]);
    unmount();
  });
});

describe('useSwapTokenSearchKeyword rounds', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a full 500ms debounce after clearing and retyping the same keyword', async () => {
    const { result, unmount } = renderHook(() => useSwapTokenSearchKeyword());
    act(() => result.current.setSearchKeyword('TOKEN'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    expect(result.current.requestedSearchKeyword).toBe('TOKEN');
    expect(result.current.isSearchKeywordSettling).toBe(false);
    const firstRound = result.current.searchRound;

    act(() => result.current.setSearchKeyword(''));
    expect(result.current.requestedSearchKeyword).toBe('');
    expect(result.current.isSearchKeywordSettling).toBe(false);
    act(() => result.current.setSearchKeyword('TOKEN'));
    expect(result.current.searchRound).toBeGreaterThan(firstRound);
    expect(result.current.isSearchKeywordSettling).toBe(true);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(499);
    });
    expect(result.current.isSearchKeywordSettling).toBe(true);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(result.current.requestedSearchKeyword).toBe('TOKEN');
    expect(result.current.isSearchKeywordSettling).toBe(false);
    unmount();
  });

  it('does not start another round for an equivalent trimmed value or rerender', async () => {
    const { result, rerender, unmount } = renderHook(() =>
      useSwapTokenSearchKeyword(),
    );
    act(() => result.current.setSearchKeyword('TOKEN'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    const round = result.current.searchRound;
    act(() => result.current.setSearchKeyword(' TOKEN '));
    rerender();
    expect(result.current.searchRound).toBe(round);
    expect(result.current.isSearchKeywordSettling).toBe(false);
    unmount();
  });
});
