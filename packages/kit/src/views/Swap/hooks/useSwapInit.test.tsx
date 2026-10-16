/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { createStore } from 'jotai';

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
      updateSelectedAccountNetwork: jest.fn(),
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
const marketParams: ISwapInitParams = {
  swapSource: ESwapSource.MARKET,
  swapTabSwitchType: ESwapTabSwitchType.SWAP,
  marketSwapDirection: 'to',
  importToToken: marketToken,
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
