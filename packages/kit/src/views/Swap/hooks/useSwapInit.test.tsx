/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { createStore } from 'jotai';

import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapDirectionType,
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  ISwapInitParams,
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  ProviderJotaiContextSwap,
  swapDefaultConfigStatusAtom,
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapNetworks,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapToTokenAmountAtom,
  swapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap/atoms';
import { getLatestHomeSelectedAccountInfo } from '../utils/swapHomeSelectedAccountUtils';

import { useSwapInit } from './useSwapGlobal';

type ISwapStore = ReturnType<typeof createStore>;
const mockFetchNetworks = jest.fn<Promise<ISwapNetwork[]>, []>();
const mockGetNetworkCache = jest.fn<Promise<{ data: ISwapNetwork[] }>, []>();
let mockStore: ISwapStore;
let mockIsFocused = true;
const mockUpdateSelectedAccountNetwork = jest.fn<void, [unknown]>();
const mockSwapActions = {
  current: {
    syncNetworksSort: jest.fn(),
    needChangeToken: jest.fn(),
    selectToToken: jest.fn(),
    selectFromToken: jest.fn(),
    resetSwapTokenData: (direction: ESwapDirectionType) => {
      mockStore.set(
        direction === ESwapDirectionType.FROM
          ? swapSelectFromTokenAtom()
          : swapSelectToTokenAtom(),
        undefined,
      );
    },
    swapTypeSwitchAction: (type: ESwapTabSwitchType) => {
      mockStore.set(swapTypeSwitchAtom(), type);
    },
  },
};

jest.mock('@onekeyhq/components', () => ({ useIsOverlayPage: () => false }));
jest.mock('../../../hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockIsFocused,
}));
jest.mock('../../../hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => {
  const activeAccount = { ready: true };
  const selectedAccount = {};
  return {
    useActiveAccount: () => ({ activeAccount }),
    useSelectedAccount: () => ({ selectedAccount }),
  };
});
jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => {
  const actions = {
    current: {
      getSelectedAccount: jest.fn(),
      updateSelectedAccountNetwork: (options: unknown) =>
        mockUpdateSelectedAccountNetwork(options),
      updateSelectedAccount: jest.fn(),
    },
  };
  return { useAccountSelectorActions: () => actions };
});
jest.mock('../../../states/jotai/contexts/swap', () => ({
  ...jest.requireActual<
    typeof import('../../../states/jotai/contexts/swap/atoms')
  >('../../../states/jotai/contexts/swap/atoms'),
  useSwapActions: () => mockSwapActions,
}));
jest.mock('./useSwapAccount', () => {
  const addressInfo = {
    networkId: 'evm--1',
    accountInfo: { ready: true },
  };
  return { useSwapAddressInfo: () => addressInfo };
});
jest.mock('./useSwapPro', () => ({
  useSwapProInputToken: () => undefined,
}));
jest.mock('../utils/swapHomeSelectedAccountUtils', () => ({
  getLatestHomeSelectedAccountInfo: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: {
      swapNetworksSort: {
        getRawData: () => mockGetNetworkCache(),
        setRawData: jest.fn().mockResolvedValue(undefined),
      },
      swapConfigs: {
        getSwapUserCloseTips: jest.fn().mockResolvedValue([]),
        getSwapProviderManager: jest.fn().mockResolvedValue([]),
        getBridgeProviderManager: jest.fn().mockResolvedValue([]),
      },
    },
    serviceSwap: {
      fetchSwapNetworks: () => mockFetchNetworks(),
      fetchSwapConfigs: jest.fn().mockResolvedValue(undefined),
      fetchSwapTips: jest.fn().mockResolvedValue(undefined),
      swapRecentTokenSync: jest.fn().mockResolvedValue(undefined),
      getSwapProviderManager: jest.fn().mockResolvedValue([]),
      fetchSwapNativeTokenConfig: jest.fn().mockResolvedValue({
        networkId: 'evm--1',
        reserveGas: '0',
      }),
    },
  },
}));

const marketToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xmarket',
  symbol: 'MARKET',
  decimals: 18,
};
const cachedNetwork: ISwapNetwork = {
  networkId: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
  supportSingleSwap: false,
  supportCrossChainSwap: false,
  supportLimit: false,
  supportStock: false,
  backendIndex: true,
  isDeFiEnabled: true,
};
const freshNetwork: ISwapNetwork = {
  ...cachedNetwork,
  supportSingleSwap: true,
  supportCrossChainSwap: true,
};
const bnb: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '',
  symbol: 'BNB',
  decimals: 18,
  isNative: true,
};
const cachedBsc: ISwapNetwork = {
  ...cachedNetwork,
  networkId: bnb.networkId,
  supportCrossChainSwap: true,
};
const marketParams: ISwapInitParams = {
  swapSource: ESwapSource.MARKET,
  swapTabSwitchType: ESwapTabSwitchType.SWAP,
  marketSwapDirection: 'to',
  importToToken: marketToken,
  importFromToken: swapDefaultSetTokens['evm--1'].toToken,
};
const emptyHomeAccountInfo = {
  selectedAccount: undefined,
  selectedAccountUpdatedAt: undefined,
  sourceRuntimeId: undefined,
};

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: Error) => void = () => {};
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderMarket(params = marketParams) {
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <ProviderJotaiContextSwap store={mockStore}>
        {children}
      </ProviderJotaiContextSwap>
    );
  }
  return renderHook((input) => useSwapInit(input), {
    initialProps: params,
    wrapper: Wrapper,
  });
}

function expectEmptyPair() {
  expect(mockStore.get(swapSelectFromTokenAtom())).toBeUndefined();
  expect(mockStore.get(swapSelectToTokenAtom())).toBeUndefined();
}

function expectMarketPair(token = marketToken) {
  expect(mockStore.get(swapSelectFromTokenAtom())?.symbol).toBe('USDC');
  expect(mockStore.get(swapSelectToTokenAtom())).toEqual(token);
}

describe('Market import with cached network capabilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchNetworks.mockReset();
    mockGetNetworkCache.mockResolvedValue({ data: [cachedNetwork] });
    mockSwapActions.current.syncNetworksSort.mockReset();
    jest
      .mocked(getLatestHomeSelectedAccountInfo)
      .mockReset()
      .mockResolvedValue(emptyHomeAccountInfo);
    mockStore = createStore();
    mockIsFocused = true;
    // The embedded panel seeds its pair before useSwapInit validates capabilities.
    mockStore.set(swapSelectToTokenAtom(), marketToken);
    mockStore.set(swapInitialSelectedTokensSyncedAtom(), true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the entry-selected stablecoin while network capabilities refresh', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockGetNetworkCache.mockResolvedValue({ data: [cachedBsc, freshNetwork] });
    mockFetchNetworks.mockReturnValue(request.promise);
    // The real sorting action writes a new array even if order is unchanged.
    mockSwapActions.current.syncNetworksSort.mockImplementationOnce(() => {
      mockStore.set(swapNetworks(), [...mockStore.get(swapNetworks())]);
    });
    renderMarket({ ...marketParams, importToToken: bnb });
    await waitFor(() =>
      expect(mockStore.get(swapSelectFromTokenAtom())?.networkId).toBe(
        'evm--1',
      ),
    );
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(bnb);
    expect(mockSwapActions.current.syncNetworksSort).toHaveBeenCalledTimes(1);

    await act(async () =>
      request.resolve([
        { ...cachedBsc, supportSingleSwap: true },
        freshNetwork,
      ]),
    );

    expect(mockStore.get(swapSelectFromTokenAtom())?.networkId).toBe('evm--1');
    expectMarketPair(bnb);
    expect(mockFetchNetworks).toHaveBeenCalledTimes(1);
    expect(mockSwapActions.current.syncNetworksSort).toHaveBeenCalledTimes(2);
  });

  it('fills a cached single-sided pair when fresh capabilities provide a counterpart', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockGetNetworkCache.mockResolvedValue({ data: [cachedBsc] });
    mockFetchNetworks.mockReturnValue(request.promise);
    renderMarket({ ...marketParams, importToToken: bnb });
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));
    expect(mockStore.get(swapSelectFromTokenAtom())).toBeUndefined();
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(bnb);

    await act(async () => request.resolve([cachedBsc, freshNetwork]));

    expectMarketPair(bnb);
    expect(mockStore.get(swapSelectFromTokenAtom())?.networkId).toBe('evm--1');
  });

  it.each(['from', 'to'] as const)(
    'preserves a user %s amount on the provisional complete pair',
    async (side) => {
      const request = deferred<ISwapNetwork[]>();
      mockGetNetworkCache.mockResolvedValue({
        data: [cachedBsc, freshNetwork],
      });
      mockFetchNetworks.mockReturnValue(request.promise);
      renderMarket({ ...marketParams, importToToken: bnb });
      await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));
      const amountAtom =
        side === 'from' ? swapFromTokenAmountAtom() : swapToTokenAmountAtom();
      act(() => mockStore.set(amountAtom, { value: '7', isInput: true }));

      await act(async () =>
        request.resolve([
          { ...cachedBsc, supportSingleSwap: true },
          freshNetwork,
        ]),
      );

      expectMarketPair(bnb);
      expect(mockStore.get(swapSelectFromTokenAtom())?.networkId).toBe(
        'evm--1',
      );
      expect(mockStore.get(amountAtom)).toEqual({ value: '7', isInput: true });
    },
  );

  it('preserves a manual token change on the provisional complete pair', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockGetNetworkCache.mockResolvedValue({ data: [cachedBsc, freshNetwork] });
    mockFetchNetworks.mockReturnValue(request.promise);
    renderMarket({ ...marketParams, importToToken: bnb });
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));
    act(() => mockStore.set(swapSelectFromTokenAtom(), marketToken));

    await act(async () =>
      request.resolve([
        { ...cachedBsc, supportSingleSwap: true },
        freshNetwork,
      ]),
    );

    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(marketToken);
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(bnb);
  });

  it('reconciles metadata updates and quote amounts without treating them as manual input', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockGetNetworkCache.mockResolvedValue({ data: [cachedBsc, freshNetwork] });
    mockFetchNetworks.mockReturnValue(request.promise);
    renderMarket({ ...marketParams, importToToken: bnb });
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));
    act(() => {
      mockStore.set(swapSelectToTokenAtom(), { ...bnb, price: '600' });
      mockStore.set(swapToTokenAmountAtom(), { value: '7', isInput: false });
    });

    await act(async () =>
      request.resolve([
        { ...cachedBsc, supportSingleSwap: true },
        freshNetwork,
      ]),
    );

    expectMarketPair(bnb);
    expect(mockStore.get(swapSelectFromTokenAtom())?.networkId).toBe('evm--1');
    expect(mockStore.get(swapToTokenAmountAtom()).value).toBe('7');
  });

  it('does not restore an older Market intent after Stock takes ownership during the Home await', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    const { rerender } = renderMarket();
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));
    const homeAccountRequest =
      deferred<Awaited<ReturnType<typeof getLatestHomeSelectedAccountInfo>>>();
    jest
      .mocked(getLatestHomeSelectedAccountInfo)
      .mockReturnValueOnce(homeAccountRequest.promise);
    await act(async () => request.resolve([freshNetwork]));
    rerender({ ...marketParams, swapTabSwitchType: ESwapTabSwitchType.STOCK });
    await act(async () => {});

    await act(async () => homeAccountRequest.resolve(emptyHomeAccountInfo));

    expectEmptyPair();
  });

  it.each([false, true])(
    'restores the Market pair after refreshing cached unsupported flags (warm store=%s)',
    async (warmStore) => {
      const request = deferred<ISwapNetwork[]>();
      mockFetchNetworks.mockReturnValue(request.promise);
      if (warmStore) {
        mockStore.set(swapNetworks(), [cachedNetwork]);
        mockStore.set(swapDefaultConfigStatusAtom(), 'success');
      }
      renderMarket();
      await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));
      expectEmptyPair();

      await act(async () => request.resolve([freshNetwork]));

      expectMarketPair();
    },
  );

  it('restores the Market pair after a failed refresh succeeds on the existing retry', async () => {
    jest.useFakeTimers();
    mockFetchNetworks
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue([freshNetwork]);
    renderMarket();
    await act(async () => {});
    expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('failed');
    expectEmptyPair();

    await act(async () => jest.advanceTimersByTime(30_000));

    expect(mockFetchNetworks).toHaveBeenCalledTimes(2);
    expectMarketPair();
  });

  it('keeps the token and amount the user chose while the capability refresh was pending', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    renderMarket({ ...marketParams, fromAmount: '12' });
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));
    expectEmptyPair();
    const manuallySelectedToken = {
      ...marketToken,
      contractAddress: '0xmanual',
      symbol: 'MANUAL',
    };
    act(() => {
      mockStore.set(swapSelectFromTokenAtom(), manuallySelectedToken);
      mockStore.set(swapFromTokenAmountAtom(), { value: '7', isInput: true });
    });

    await act(async () => request.resolve([freshNetwork]));

    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(
      manuallySelectedToken,
    );
    expect(mockStore.get(swapSelectToTokenAtom())).toBeUndefined();
    expect(mockStore.get(swapFromTokenAmountAtom())).toEqual({
      value: '7',
      isInput: true,
    });
  });

  it('keeps a genuinely unsupported fresh Market result empty without seeding Trade defaults', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    renderMarket();
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));

    await act(async () => request.resolve([{ ...cachedNetwork }]));

    expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('success');
    expectEmptyPair();
    expect(mockStore.get(swapFromTokenAmountAtom()).value).toBe('');
    expect(mockStore.get(swapToTokenAmountAtom()).value).toBe('');
  });

  it('keeps a manual selection made while refreshed initialization is awaiting the Home account', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    const { rerender } = renderMarket();
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));
    expectEmptyPair();
    const homeAccountRequest =
      deferred<Awaited<ReturnType<typeof getLatestHomeSelectedAccountInfo>>>();
    const getHomeAccount = jest.mocked(getLatestHomeSelectedAccountInfo);
    const homeReadsBeforeRefresh = getHomeAccount.mock.calls.length;
    getHomeAccount.mockReturnValueOnce(homeAccountRequest.promise);

    await act(async () => request.resolve([freshNetwork]));
    expect(getHomeAccount).toHaveBeenCalledTimes(homeReadsBeforeRefresh + 1);
    expectEmptyPair();
    const manuallySelectedToken = {
      ...marketToken,
      contractAddress: '0xmanual',
      symbol: 'MANUAL',
    };
    act(() => {
      mockStore.set(swapSelectToTokenAtom(), manuallySelectedToken);
      mockStore.set(swapToTokenAmountAtom(), { value: '9', isInput: true });
    });
    mockIsFocused = false;
    rerender(marketParams);
    mockIsFocused = true;
    rerender(marketParams);

    await act(async () => homeAccountRequest.resolve(emptyHomeAccountInfo));

    expect(mockStore.get(swapSelectFromTokenAtom())).toBeUndefined();
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(
      manuallySelectedToken,
    );
    expect(mockStore.get(swapToTokenAmountAtom())).toEqual({
      value: '9',
      isInput: true,
    });
  });

  it('applies a newer Market intent instead of restoring the deferred token', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    const { rerender } = renderMarket();
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));
    expectEmptyPair();
    const nextMarketToken = {
      ...marketToken,
      contractAddress: '0xnext',
      symbol: 'NEXT',
    };
    rerender({ ...marketParams, importToToken: nextMarketToken });
    await act(async () => {});

    await act(async () => request.resolve([freshNetwork]));

    expectMarketPair(nextMarketToken);
  });
});

const sol: ISwapToken = {
  networkId: 'sol--101',
  contractAddress: '',
  symbol: 'SOL',
  decimals: 9,
  isNative: true,
};
const solUsdt: ISwapToken = {
  networkId: sol.networkId,
  contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  symbol: 'USDT',
  decimals: 6,
  isNative: false,
};
const solNetwork: ISwapNetwork = {
  ...freshNetwork,
  networkId: sol.networkId,
  symbol: 'SOL',
  name: 'Solana',
  defaultSelectTokenDetail: { from: sol, to: solUsdt },
};

describe('asset entry default counterpart ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = createStore();
    mockIsFocused = true;
    mockFetchNetworks.mockReset();
    mockGetNetworkCache.mockResolvedValue({ data: [] });
    jest
      .mocked(getLatestHomeSelectedAccountInfo)
      .mockResolvedValue(emptyHomeAccountInfo);
  });

  it.each([ESwapSource.WALLET_HOME_TOKEN_LIST, ESwapSource.TOKEN_DETAIL])(
    'uses the API counterpart for %s while retaining the clicked SOL',
    async (swapSource) => {
      mockFetchNetworks.mockResolvedValue([solNetwork]);
      renderMarket({
        importFromToken: sol,
        importNetworkId: sol.networkId,
        swapSource,
        swapTabSwitchType: ESwapTabSwitchType.SWAP,
      });
      await waitFor(() =>
        expect(mockStore.get(swapSelectToTokenAtom())).toEqual(solUsdt),
      );
      expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(sol);
    },
  );

  it('falls back locally when networks refresh fails', async () => {
    mockGetNetworkCache.mockResolvedValue({ data: [solNetwork] });
    mockFetchNetworks.mockRejectedValue(new Error('offline'));
    renderMarket({
      importFromToken: sol,
      swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
    });
    await waitFor(() =>
      expect(mockStore.get(swapSelectToTokenAtom())?.symbol).toBe('USDC'),
    );
    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(sol);
  });

  it.each([ESwapSource.WALLET_HOME_TOKEN_LIST, ESwapSource.TOKEN_DETAIL])(
    'shows the local default then refreshes it without clearing the amount for %s',
    async (swapSource) => {
      const request = deferred<ISwapNetwork[]>();
      mockFetchNetworks.mockReturnValue(request.promise);
      renderMarket({
        importFromToken: sol,
        swapSource,
      });
      await waitFor(() =>
        expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(sol),
      );
      expect(mockStore.get(swapSelectToTokenAtom())?.symbol).toBe('USDC');
      act(() =>
        mockStore.set(swapFromTokenAmountAtom(), {
          value: '0.25',
          isInput: true,
        }),
      );
      await act(async () => request.resolve([solNetwork]));
      await waitFor(() =>
        expect(mockStore.get(swapSelectToTokenAtom())).toEqual(solUsdt),
      );
      expect(mockStore.get(swapFromTokenAmountAtom())).toEqual({
        value: '0.25',
        isInput: true,
      });
    },
  );

  it('uses the cached default while fresh configuration is pending', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    mockGetNetworkCache.mockResolvedValue({ data: [solNetwork] });
    renderMarket({
      importFromToken: sol,
      swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
    });
    await waitFor(() =>
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(solUsdt),
    );
    expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('pending');
    await act(async () => request.resolve([solNetwork]));
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(solUsdt);
  });

  it.each([
    { previousStatus: 'success', manualSelection: false },
    { previousStatus: 'success', manualSelection: true },
    { previousStatus: 'failed', manualSelection: false },
    { previousStatus: 'failed', manualSelection: true },
  ] as const)(
    'refreshes a previous $previousStatus result, preserving manual selection=$manualSelection',
    async ({ previousStatus, manualSelection }) => {
      const request = deferred<ISwapNetwork[]>();
      const cached = {
        ...solNetwork,
        defaultSelectTokenDetail: {
          from: sol,
          to: swapDefaultSetTokens[sol.networkId].toToken,
        },
      };
      mockStore.set(swapNetworks(), [cached]);
      mockStore.set(swapDefaultConfigStatusAtom(), previousStatus);
      mockGetNetworkCache.mockResolvedValue({ data: [cached] });
      mockFetchNetworks.mockReturnValue(request.promise);
      renderMarket({
        importFromToken: sol,
        importNetworkId: sol.networkId,
        swapSource: ESwapSource.TOKEN_DETAIL,
      });
      await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalled());
      expect(mockStore.get(swapSelectToTokenAtom())?.symbol).toBe('USDC');
      expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('pending');
      const manualToken = { ...solUsdt, contractAddress: 'manual-token' };
      if (manualSelection) {
        act(() => mockStore.set(swapSelectToTokenAtom(), manualToken));
      }
      await act(async () => request.resolve([solNetwork]));
      await waitFor(() =>
        expect(mockStore.get(swapSelectToTokenAtom())).toEqual(
          manualSelection ? manualToken : solUsdt,
        ),
      );
    },
  );

  it.each(['success', 'failed'] as const)(
    'settles the empty counterpart after %s when no default exists',
    async (status) => {
      const request = deferred<ISwapNetwork[]>();
      mockFetchNetworks.mockReturnValue(request.promise);
      const tokenWithoutDefaults = { ...sol, networkId: 'missing--1' };
      renderMarket({
        importFromToken: tokenWithoutDefaults,
        swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
      });
      await waitFor(() =>
        expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(
          tokenWithoutDefaults,
        ),
      );
      expect(mockStore.get(swapSelectToTokenAtom())).toBeUndefined();
      expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('pending');
      await act(async () => {
        if (status === 'failed') {
          request.reject(new Error('offline'));
        } else {
          request.resolve([
            {
              ...solNetwork,
              networkId: tokenWithoutDefaults.networkId,
              defaultSelectTokenDetail: undefined,
            },
          ]);
        }
      });
      await waitFor(() =>
        expect(mockStore.get(swapInitialSelectedTokensSyncedAtom())).toBe(true),
      );
      expect(mockStore.get(swapSelectToTokenAtom())).toBeUndefined();
    },
  );

  it('does not replace a manual selection made before an empty cache finishes loading', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    renderMarket({
      importFromToken: sol,
      swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
    });
    await waitFor(() =>
      expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(sol),
    );
    const manual = {
      ...solUsdt,
      contractAddress: 'manual-token',
      symbol: 'MANUAL',
    };
    act(() => mockStore.set(swapSelectToTokenAtom(), manual));
    await act(async () => request.resolve([solNetwork]));
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(manual);
  });

  it('keeps an explicitly imported pair even when the API default differs', async () => {
    mockFetchNetworks.mockResolvedValue([solNetwork]);
    const explicitTo = swapDefaultSetTokens[sol.networkId].toToken;
    renderMarket({
      importFromToken: sol,
      importToToken: explicitTo,
      swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
    });
    await waitFor(() =>
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(explicitTo),
    );
  });

  it.each([ESwapSource.WALLET_HOME_TOKEN_LIST, ESwapSource.TOKEN_DETAIL])(
    'keeps manual To when the first active %s init starts with settled config',
    async (swapSource) => {
      mockIsFocused = false;
      mockFetchNetworks.mockResolvedValue([solNetwork]);
      const params: ISwapInitParams = {
        importFromToken: sol,
        importNetworkId: sol.networkId,
        swapSource,
      };
      const { rerender } = renderMarket(params);
      await waitFor(() =>
        expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('success'),
      );
      const home =
        deferred<
          Awaited<ReturnType<typeof getLatestHomeSelectedAccountInfo>>
        >();
      jest
        .mocked(getLatestHomeSelectedAccountInfo)
        .mockReturnValue(home.promise);
      mockIsFocused = true;
      rerender(params);
      await waitFor(() =>
        expect(mockStore.get(swapSelectToTokenAtom())).toEqual(solUsdt),
      );
      const manualTo = { ...solUsdt, contractAddress: 'manual' };
      act(() => {
        mockStore.set(swapSelectToTokenAtom(), manualTo);
        mockStore.set(swapFromTokenAmountAtom(), {
          value: '0.25',
          isInput: true,
        });
      });
      await act(async () => home.resolve(emptyHomeAccountInfo));
      expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(sol);
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(manualTo);
      expect(mockStore.get(swapFromTokenAmountAtom())).toEqual({
        value: '0.25',
        isInput: true,
      });
    },
  );

  it('keeps a consumed Market pair and amount when the configured counterpart refreshes', async () => {
    mockFetchNetworks.mockResolvedValue([freshNetwork]);
    const { rerender } = renderMarket();
    await waitFor(() =>
      expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('success'),
    );
    await waitFor(() =>
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(marketToken),
    );
    const manualFrom = {
      ...marketParams.importFromToken!,
      contractAddress: 'manual',
      symbol: 'MANUAL',
    };
    act(() => {
      mockStore.set(swapSelectFromTokenAtom(), manualFrom);
      mockStore.set(swapFromTokenAmountAtom(), { value: '8', isInput: true });
    });
    rerender({
      ...marketParams,
      importFromToken: { ...manualFrom, contractAddress: 'new-config' },
    });
    await act(async () => {});
    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(manualFrom);
    expect(mockStore.get(swapFromTokenAmountAtom())).toEqual({
      value: '8',
      isInput: true,
    });
  });

  it('shows ordinary local defaults without a snapshot or network cache', async () => {
    mockStore.set(swapSelectToTokenAtom(), undefined);
    mockStore.set(swapInitialSelectedTokensSyncedAtom(), false);
    mockGetNetworkCache.mockResolvedValue({ data: [] });
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    renderMarket({});
    await waitFor(() =>
      expect(mockStore.get(swapSelectFromTokenAtom())?.symbol).toBe('ETH'),
    );
    expect(mockStore.get(swapSelectToTokenAtom())?.symbol).toBe('USDC');
    expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('pending');
    const usdt: ISwapToken = {
      ...swapDefaultSetTokens['evm--1'].toToken!,
      symbol: 'USDT',
      contractAddress: 'usdt',
    };
    await act(async () =>
      request.resolve([
        {
          ...freshNetwork,
          defaultSelectTokenDetail: {
            from: swapDefaultSetTokens['evm--1'].fromToken,
            to: usdt,
          },
        },
      ]),
    );
    expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('success');
  });

  it('does not change account network or mode after an automatic Market intent was consumed', async () => {
    mockFetchNetworks.mockResolvedValue([freshNetwork]);
    const { rerender } = renderMarket();
    await waitFor(() =>
      expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('success'),
    );
    await waitFor(() =>
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(marketToken),
    );
    act(() => mockStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT));
    mockUpdateSelectedAccountNetwork.mockClear();
    rerender({
      ...marketParams,
      importFromToken: solUsdt,
      importNetworkId: solUsdt.networkId,
      swapTabSwitchType: ESwapTabSwitchType.BRIDGE,
    });
    await act(async () => {});
    expect(mockUpdateSelectedAccountNetwork).not.toHaveBeenCalled();
    expect(mockStore.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
  });

  it('does not resume an asset import after the user changes mode during Home await', async () => {
    mockIsFocused = false;
    mockFetchNetworks.mockResolvedValue([solNetwork]);
    const params: ISwapInitParams = {
      importFromToken: sol,
      swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
    };
    const { rerender } = renderMarket(params);
    await waitFor(() =>
      expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('success'),
    );
    const home =
      deferred<Awaited<ReturnType<typeof getLatestHomeSelectedAccountInfo>>>();
    jest.mocked(getLatestHomeSelectedAccountInfo).mockReturnValue(home.promise);
    mockIsFocused = true;
    rerender(params);
    await waitFor(() =>
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(solUsdt),
    );
    act(() => {
      mockStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
      mockStore.set(swapToTokenAmountAtom(), { value: '7', isInput: true });
    });
    await act(async () => home.resolve(emptyHomeAccountInfo));
    expect(mockStore.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(solUsdt);
    expect(mockStore.get(swapToTokenAmountAtom())).toEqual({
      value: '7',
      isInput: true,
    });
  });

  it.each([
    ESwapTabSwitchType.SWAP,
    ESwapTabSwitchType.LIMIT,
    ESwapTabSwitchType.STOCK,
  ])(
    'preserves same-mode Details input without importing a previous %s draft',
    async (oldType) => {
      mockStore.set(swapSelectFromTokenAtom(), sol);
      mockStore.set(swapSelectToTokenAtom(), solUsdt);
      mockStore.set(swapFromTokenAmountAtom(), {
        value: '0.25',
        isInput: true,
      });
      mockStore.set(swapTypeSwitchAtom(), oldType);
      mockFetchNetworks.mockResolvedValue([solNetwork]);
      const switchMode = jest
        .spyOn(mockSwapActions.current, 'swapTypeSwitchAction')
        .mockImplementation((type) => {
          mockStore.set(swapTypeSwitchAtom(), type);
          // The actual action restores the destination mode's saved pair/amount.
          mockStore.set(swapFromTokenAmountAtom(), {
            value: '7',
            isInput: true,
          });
        });
      renderMarket({
        importFromToken: sol,
        importNetworkId: sol.networkId,
        swapSource: ESwapSource.TOKEN_DETAIL,
      });
      await waitFor(() =>
        expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('success'),
      );
      expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(sol);
      expect(mockStore.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
      expect(mockStore.get(swapFromTokenAmountAtom()).value).toBe(
        oldType === ESwapTabSwitchType.SWAP ? '0.25' : '',
      );
      switchMode.mockRestore();
    },
  );

  it('cancels the old Home continuation when the automatic Market counterpart changes', async () => {
    mockIsFocused = false;
    mockFetchNetworks.mockResolvedValue([
      freshNetwork,
      { ...solNetwork, supportCrossChainSwap: true },
    ]);
    const { rerender } = renderMarket();
    await waitFor(() =>
      expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('success'),
    );
    const oldHome =
      deferred<Awaited<ReturnType<typeof getLatestHomeSelectedAccountInfo>>>();
    const newHome =
      deferred<Awaited<ReturnType<typeof getLatestHomeSelectedAccountInfo>>>();
    jest
      .mocked(getLatestHomeSelectedAccountInfo)
      .mockReturnValue(oldHome.promise);
    mockIsFocused = true;
    rerender(marketParams);
    await act(async () => {});
    jest
      .mocked(getLatestHomeSelectedAccountInfo)
      .mockReturnValue(newHome.promise);
    rerender({
      ...marketParams,
      importFromToken: solUsdt,
      importNetworkId: solUsdt.networkId,
      swapTabSwitchType: ESwapTabSwitchType.BRIDGE,
    });
    await act(async () => oldHome.resolve(emptyHomeAccountInfo));
    expect(mockStore.get(swapSelectFromTokenAtom())).not.toEqual(
      marketParams.importFromToken,
    );
    await act(async () => newHome.resolve(emptyHomeAccountInfo));
    await waitFor(() =>
      expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(solUsdt),
    );
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(marketToken);
  });
});
