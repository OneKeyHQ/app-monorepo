/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { createStore } from 'jotai';

import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { writeContextAtomColdStartCacheValues } from '@onekeyhq/kit-bg/src/states/jotai/utils';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
  swapNetworkConfigStatusAtom,
  swapNetworks,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedTokensColdStartContextAtom,
  swapToTokenAmountAtom,
  swapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap/atoms';
import { buildSwapDefaultSelectedTokensFromHomeAccount } from '../utils/swapColdStartTokenCacheUtils';
import {
  getHomeSelectedAccountInfoFromContextStore,
  getLatestHomeSelectedAccountInfo,
} from '../utils/swapHomeSelectedAccountUtils';

import { useSwapInit } from './useSwapGlobal';

type ISwapStore = ReturnType<typeof createStore>;
const mockFetchNetworks = jest.fn<Promise<ISwapNetwork[]>, []>();
const mockGetNetworkCache = jest.fn<Promise<{ data: ISwapNetwork[] }>, []>();
type IHomeSyncUpdate = {
  eventUpdatedAt?: number | null;
  expectedPartialSelection?: Partial<IAccountSelectorSelectedAccount>;
  shouldCommit?: () => boolean;
  builder: (
    selection: IAccountSelectorSelectedAccount,
  ) => IAccountSelectorSelectedAccount;
};
const mockGetSelectedAccount = jest.fn<
  IAccountSelectorSelectedAccount | undefined,
  [{ num: number }]
>();
const mockUpdateSelectedAccount = jest.fn<
  Promise<{ outcome: string }> | undefined,
  [IHomeSyncUpdate]
>();
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
      getSelectedAccount: (options: { num: number }) =>
        mockGetSelectedAccount(options),
      updateSelectedAccountNetwork: (options: unknown) =>
        mockUpdateSelectedAccountNetwork(options),
      updateSelectedAccount: (options: IHomeSyncUpdate) =>
        mockUpdateSelectedAccount(options),
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
  getHomeSelectedAccountInfoFromContextStore: jest.fn(),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccountSelector: {
      fixOthersWalletAccountNetworkPair: jest.fn(
        async (params: { selectedAccount: IAccountSelectorSelectedAccount }) =>
          params.selectedAccount,
      ),
    },
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

function renderMarket(params = marketParams, coldStartScopeKey?: string) {
  if (coldStartScopeKey) {
    Object.assign(mockStore, {
      __ONEKEY_JOTAI_COLD_START_SCOPE_KEY__: coldStartScopeKey,
    });
  }
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
  const btc: ISwapToken = {
    networkId: 'btc--0',
    contractAddress: '',
    symbol: 'BTC',
    decimals: 8,
    isNative: true,
  };
  const btcNetwork: ISwapNetwork = {
    ...freshNetwork,
    networkId: btc.networkId,
    symbol: 'BTC',
    name: 'Bitcoin',
    supportSingleSwap: false,
    defaultSelectTokenDetail: { from: btc, to: bnb },
  };
  const btcNetworks = [btcNetwork, cachedBsc, freshNetwork];

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

  afterEach(() => jest.useRealTimers());

  it('waits for the BTC asset entry API pair and preserves the entered amount', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    renderMarket({
      importFromToken: btc,
      swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
    });
    await waitFor(() =>
      expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(btc),
    );
    expect(mockStore.get(swapSelectToTokenAtom())).toBeUndefined();
    act(() =>
      mockStore.set(swapFromTokenAmountAtom(), {
        value: '0.25',
        isInput: true,
      }),
    );
    await act(async () => request.resolve(btcNetworks));
    await waitFor(() =>
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(bnb),
    );
    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(btc);
    expect(mockStore.get(swapFromTokenAmountAtom())).toEqual({
      value: '0.25',
      isInput: true,
    });
  });

  it.each([false, true])(
    'keeps the BTC fallback after timeout and a late response (cached=%s)',
    async (cached) => {
      jest.useFakeTimers();
      const request = deferred<ISwapNetwork[]>();
      mockFetchNetworks.mockReturnValue(request.promise);
      mockGetNetworkCache.mockResolvedValue({
        data: cached ? btcNetworks : [],
      });
      renderMarket({
        importFromToken: btc,
        swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
      });
      await act(async () => {});
      await act(async () => jest.advanceTimersByTime(2000));
      expect(mockStore.get(swapSelectToTokenAtom())?.symbol).toBe('ETH');
      await act(async () => request.resolve(btcNetworks));
      expect(mockStore.get(swapSelectToTokenAtom())?.symbol).toBe('ETH');
    },
  );

  it('falls back to ETH when the configured BTC target network is unsupported', async () => {
    mockFetchNetworks.mockResolvedValue([
      btcNetwork,
      { ...cachedBsc, supportCrossChainSwap: false },
      freshNetwork,
    ]);
    renderMarket({
      importFromToken: btc,
      swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
    });
    await waitFor(() =>
      expect(mockStore.get(swapSelectToTokenAtom())?.symbol).toBe('ETH'),
    );
    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(btc);
  });

  it.each([false, true])(
    'falls back to ETH when BTC configuration fails (cached=%s)',
    async (cached) => {
      mockGetNetworkCache.mockResolvedValue({
        data: cached ? btcNetworks : [],
      });
      mockFetchNetworks.mockRejectedValue(new Error('offline'));
      renderMarket({
        importFromToken: btc,
        swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
      });
      await waitFor(() =>
        expect(mockStore.get(swapSelectToTokenAtom())?.symbol).toBe('ETH'),
      );
      expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(btc);
    },
  );

  it('does not overwrite a manual BTC counterpart when configuration arrives', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    renderMarket({
      importFromToken: btc,
      swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
    });
    await waitFor(() =>
      expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(btc),
    );
    const manualToken = { ...bnb, contractAddress: 'manual', isNative: false };
    act(() => mockStore.set(swapSelectToTokenAtom(), manualToken));
    await act(async () => request.resolve(btcNetworks));
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(manualToken);
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
    'waits for the configured counterpart without clearing the entry or amount for %s',
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
      expect(mockStore.get(swapSelectToTokenAtom())).toBeUndefined();
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

  it('does not use a network-config cache as a selected-pair cache', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    mockGetNetworkCache.mockResolvedValue({ data: [solNetwork] });
    renderMarket({
      importFromToken: sol,
      swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
    });
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalled());
    expect(mockStore.get(swapSelectToTokenAtom())).toBeUndefined();
    expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('pending');
    await act(async () => request.resolve([solNetwork]));
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(solUsdt);
  });

  it.each([
    { previousStatus: 'success', manualSelection: false },
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
      expect(mockStore.get(swapSelectToTokenAtom())).toBeUndefined();
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

  it('waits without a pair cache and displays the configured pair directly', async () => {
    mockStore.set(swapSelectToTokenAtom(), undefined);
    mockStore.set(swapInitialSelectedTokensSyncedAtom(), false);
    mockGetNetworkCache.mockResolvedValue({ data: [] });
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    renderMarket({});
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalled());
    expectEmptyPair();
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

describe('automatic default pair ownership', () => {
  const selectedAccount = {
    walletId: 'ok64946-wallet',
    indexedAccountId: 'ok64946-account',
    deriveType: 'default',
    networkId: 'sol--101',
  } as const;
  const activeAccount = {
    ready: true,
    wallet: { id: selectedAccount.walletId },
    indexedAccount: { id: selectedAccount.indexedAccountId },
    deriveType: selectedAccount.deriveType,
    network: { id: selectedAccount.networkId },
  };
  const accountSelectorMock = jest.requireMock<{
    useActiveAccount: () => { activeAccount: typeof activeAccount };
    useSelectedAccount: () => { selectedAccount: typeof selectedAccount };
  }>('../../../states/jotai/contexts/accountSelector');
  const configuredNetwork: ISwapNetwork = {
    ...solNetwork,
    defaultSelectTokenDetail: { from: solUsdt, to: sol },
  };
  const entries: { label: string; params: ISwapInitParams }[] = [
    { label: 'root Trade', params: {} },
    {
      label: 'Wallet Home network-only modal',
      params: {
        swapSource: ESwapSource.WALLET_HOME,
        importNetworkId: sol.networkId,
      },
    },
  ];
  async function startPendingEntry(params: ISwapInitParams, cachedPair = true) {
    const defaults = buildSwapDefaultSelectedTokensFromHomeAccount({
      homeSelectedAccount: selectedAccount,
      swapType: ESwapTabSwitchType.SWAP,
      swapNetworks: [],
      defaultConfigStatus: 'failed',
    });
    if (!defaults?.fromToken || !defaults.toToken) {
      throw new OneKeyLocalError('SOL automatic default fixture unavailable');
    }
    mockStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
    mockStore.set(
      swapSelectFromTokenAtom(),
      cachedPair ? defaults.fromToken : undefined,
    );
    mockStore.set(
      swapSelectToTokenAtom(),
      cachedPair ? defaults.toToken : undefined,
    );
    mockStore.set(
      swapSelectedTokensColdStartContextAtom(),
      cachedPair ? defaults.context : undefined,
    );
    mockStore.set(swapInitialSelectedTokensSyncedAtom(), false);
    mockStore.set(swapDefaultConfigStatusAtom(), 'pending');
    mockStore.set(swapFromTokenAmountAtom(), { value: '', isInput: false });
    mockStore.set(swapToTokenAmountAtom(), { value: '', isInput: false });
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    const view = renderMarket(params);
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));
    if (mockIsFocused) {
      await waitFor(() =>
        expect(getLatestHomeSelectedAccountInfo).toHaveBeenCalled(),
      );
    }
    await act(async () => {});
    return { defaults, request, view };
  }
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = createStore();
    mockIsFocused = true;
    mockFetchNetworks.mockReset();
    mockGetNetworkCache.mockResolvedValue({ data: [] });
    mockSwapActions.current.syncNetworksSort.mockReset();
    jest
      .mocked(getLatestHomeSelectedAccountInfo)
      .mockReset()
      .mockResolvedValue(emptyHomeAccountInfo);
    jest
      .spyOn(accountSelectorMock, 'useActiveAccount')
      .mockReturnValue({ activeAccount });
    jest
      .spyOn(accountSelectorMock, 'useSelectedAccount')
      .mockReturnValue({ selectedAccount });
    const addressInfoMock = jest.requireMock<{
      useSwapAddressInfo: () => {
        networkId: string;
        accountInfo: { ready: boolean };
      };
    }>('./useSwapAccount');
    jest.spyOn(addressInfoMock, 'useSwapAddressInfo').mockReturnValue({
      networkId: sol.networkId,
      accountInfo: { ready: true },
    });
  });
  afterEach(() => jest.restoreAllMocks());
  async function finish(
    request: ReturnType<typeof deferred<ISwapNetwork[]>>,
    networks = [configuredNetwork],
  ) {
    await act(async () => request.resolve(networks));
    await waitFor(() =>
      expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('success'),
    );
    await act(async () => {});
  }
  it('keeps an imported counterpart loading until entry initialization has written the pair', async () => {
    const { request } = await startPendingEntry(
      {
        importFromToken: sol,
        swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
      },
      false,
    );
    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(sol);
    expect(
      mockStore.get(swapSelectedTokensColdStartContextAtom()),
    ).toBeDefined();
    expect(mockStore.get(swapInitialSelectedTokensSyncedAtom())).toBe(false);

    const completedCounterparts: (ISwapToken | undefined)[] = [];
    const recordCompletedCounterpart = () => {
      if (
        mockStore.get(swapDefaultConfigStatusAtom()) !== 'pending' &&
        mockStore.get(swapInitialSelectedTokensSyncedAtom())
      ) {
        completedCounterparts.push(mockStore.get(swapSelectToTokenAtom()));
      }
    };
    const unsubscribe = [
      mockStore.sub(swapDefaultConfigStatusAtom(), recordCompletedCounterpart),
      mockStore.sub(
        swapInitialSelectedTokensSyncedAtom(),
        recordCompletedCounterpart,
      ),
      mockStore.sub(swapSelectToTokenAtom(), recordCompletedCounterpart),
    ];
    try {
      await finish(request);
      expect(mockStore.get(swapInitialSelectedTokensSyncedAtom())).toBe(true);
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(solUsdt);
      expect(completedCounterparts.length).toBeGreaterThan(0);
      expect(completedCounterparts).not.toContain(undefined);
    } finally {
      unsubscribe.forEach((stop) => stop());
    }
  });
  it.each(entries)(
    '$label adopts fresh defaults for an untouched automatic pair',
    async ({ params }) => {
      const { defaults, request } = await startPendingEntry(params);
      const seedWhilePending = mockStore.get(
        swapSelectedTokensColdStartContextAtom(),
      )?.defaultTokenSeed;
      await finish(request);
      expect({
        seedWhilePending,
        from: mockStore.get(swapSelectFromTokenAtom()),
        to: mockStore.get(swapSelectToTokenAtom()),
      }).toEqual({
        seedWhilePending: defaults.context.defaultTokenSeed,
        from: solUsdt,
        to: sol,
      });
    },
  );
  it.each(['active', 'unmount', 'refocus'])(
    'waits for the Home owner before importing a network (%s)',
    async (lifecycle) => {
      const homeRead =
        deferred<
          Awaited<ReturnType<typeof getLatestHomeSelectedAccountInfo>>
        >();
      jest
        .mocked(getLatestHomeSelectedAccountInfo)
        .mockReturnValue(homeRead.promise);
      const addressInfoMock = jest.requireMock<{
        useSwapAddressInfo: () => {
          networkId: string;
          accountInfo: { ready: boolean };
        };
      }>('./useSwapAccount');
      jest.spyOn(addressInfoMock, 'useSwapAddressInfo').mockReturnValue({
        networkId: 'evm--1',
        accountInfo: { ready: true },
      });
      mockUpdateSelectedAccountNetwork.mockClear();
      const entryParams = {
        swapSource: ESwapSource.WALLET_HOME,
        importNetworkId: sol.networkId,
      };
      const { request, view } = await startPendingEntry(
        entryParams,
        lifecycle !== 'active',
      );
      expect(mockUpdateSelectedAccountNetwork).not.toHaveBeenCalled();
      if (lifecycle === 'unmount') view.unmount();
      if (lifecycle === 'refocus') {
        mockIsFocused = false;
        view.rerender(entryParams);
        mockIsFocused = true;
        view.rerender(entryParams);
      }
      await act(async () => homeRead.resolve(emptyHomeAccountInfo));
      if (lifecycle === 'unmount') {
        expect(mockUpdateSelectedAccountNetwork).not.toHaveBeenCalled();
      } else {
        expect(mockUpdateSelectedAccountNetwork).toHaveBeenCalledWith(
          expect.objectContaining({
            networkId: sol.networkId,
            reason: 'swapImportNetworkSync',
            shouldCommit: expect.any(Function),
          }),
        );
        view.unmount();
      }
      await act(async () => request.resolve([configuredNetwork]));
    },
  );
  it.each(
    entries.flatMap((entry) => [
      { ...entry, direction: ESwapDirectionType.FROM },
      { ...entry, direction: ESwapDirectionType.TO },
    ]),
  )(
    '$label preserves a manual $direction token after fresh defaults arrive',
    async ({ params, direction }) => {
      const { defaults, request } = await startPendingEntry(params);
      const tokenAtom =
        direction === ESwapDirectionType.FROM
          ? swapSelectFromTokenAtom()
          : swapSelectToTokenAtom();
      await act(async () => {
        mockStore.set(tokenAtom, solUsdt);
      });
      await finish(request);
      expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(
        direction === ESwapDirectionType.FROM ? solUsdt : defaults.fromToken,
      );
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(
        direction === ESwapDirectionType.TO ? solUsdt : defaults.toToken,
      );
    },
  );
  it.each(
    entries.flatMap((entry) => [
      { ...entry, direction: ESwapDirectionType.FROM },
      { ...entry, direction: ESwapDirectionType.TO },
    ]),
  )(
    '$label preserves a pair owned by a nonempty $direction amount',
    async ({ params, direction }) => {
      const amountAtom =
        direction === ESwapDirectionType.FROM
          ? swapFromTokenAmountAtom()
          : swapToTokenAmountAtom();
      const { defaults, request } = await startPendingEntry(params);
      await act(async () => {
        mockStore.set(amountAtom, { value: '0.25', isInput: true });
      });
      await finish(request);
      expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(
        defaults.fromToken,
      );
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(defaults.toToken);
      expect(mockStore.get(amountAtom)).toEqual({
        value: '0.25',
        isInput: true,
      });
    },
  );

  it('adopts settled defaults on the first focused Wallet Home initialization', async () => {
    mockIsFocused = false;
    const params: ISwapInitParams = {
      swapSource: ESwapSource.WALLET_HOME,
      importNetworkId: sol.networkId,
    };
    const { defaults, request, view } = await startPendingEntry(params);
    await finish(request);
    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(
      defaults.fromToken,
    );
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(defaults.toToken);
    mockIsFocused = true;
    view.rerender(params);
    await waitFor(() =>
      expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(solUsdt),
    );
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(sol);
  });

  it('preserves an explicitly imported pair when the configuration differs', async () => {
    const { request } = await startPendingEntry({
      swapSource: ESwapSource.WALLET_HOME,
      importNetworkId: sol.networkId,
      importFromToken: sol,
      importToToken: solUsdt,
    });
    await finish(request);
    await waitFor(() =>
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(solUsdt),
    );
    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(sol);
    expect(
      mockStore.get(swapSelectedTokensColdStartContextAtom())?.defaultTokenSeed,
    ).toBeUndefined();
  });

  it('preserves the pair and amount supplied by a network-only entry', async () => {
    const { defaults, request } = await startPendingEntry({
      swapSource: ESwapSource.WALLET_HOME,
      importNetworkId: sol.networkId,
      fromAmount: '0.25',
    });
    await finish(request);
    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(
      defaults.fromToken,
    );
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(defaults.toToken);
    expect(mockStore.get(swapFromTokenAmountAtom())).toEqual({
      value: '0.25',
      isInput: true,
    });
    expect(
      mockStore.get(swapSelectedTokensColdStartContextAtom())?.defaultTokenSeed,
    ).toBeUndefined();
  });

  it('clears the pair when the imported network does not support Swap', async () => {
    const { request } = await startPendingEntry({
      swapSource: ESwapSource.WALLET_HOME,
      importNetworkId: sol.networkId,
    });
    await finish(request, [
      {
        ...configuredNetwork,
        supportSingleSwap: false,
        supportCrossChainSwap: false,
      },
    ]);
    await waitFor(expectEmptyPair);
  });
});

describe('empty Swap bootstrap with a newer restored account revision', () => {
  const homeSelectedAccount: IAccountSelectorSelectedAccount = {
    walletId: 'bootstrap-wallet',
    indexedAccountId: 'bootstrap-account',
    othersWalletAccountId: undefined,
    focusedWallet: undefined,
    deriveType: 'default',
    networkId: 'onekeyall--0',
  };
  const homeInfo = {
    selectedAccount: homeSelectedAccount,
    selectedAccountUpdatedAt: 100,
    sourceRuntimeId: 'bootstrap-runtime',
  };
  const configuredTo: ISwapToken = { ...marketToken, symbol: 'CONFIGURED' };
  const configuredNetwork: ISwapNetwork = {
    ...freshNetwork,
    defaultSelectTokenDetail: {
      from: {
        networkId: 'evm--1',
        contractAddress: '',
        symbol: 'ETH',
        decimals: 18,
        isNative: true,
      },
      to: configuredTo,
    },
  };
  let selectedAccount: IAccountSelectorSelectedAccount;
  let revision: number;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = createStore();
    mockIsFocused = true;
    selectedAccount = { ...homeSelectedAccount, networkId: 'evm--1' };
    revision = 200;
    mockGetNetworkCache.mockResolvedValue({ data: [] });
    mockFetchNetworks.mockReset();
    jest.mocked(getLatestHomeSelectedAccountInfo).mockResolvedValue(homeInfo);
    jest
      .mocked(getHomeSelectedAccountInfoFromContextStore)
      .mockReturnValue(homeInfo);
    mockGetSelectedAccount.mockImplementation(() => selectedAccount);
    mockUpdateSelectedAccount.mockImplementation(async (update) => {
      if (update.shouldCommit && !update.shouldCommit())
        return { outcome: 'stale' };
      if (
        update.eventUpdatedAt !== undefined &&
        update.eventUpdatedAt !== null &&
        update.eventUpdatedAt < revision
      )
        return { outcome: 'skip-older-event' };
      if (
        update.expectedPartialSelection &&
        Object.entries(update.expectedPartialSelection).some(
          ([key, value]) =>
            selectedAccount[key as keyof IAccountSelectorSelectedAccount] !==
            value,
        )
      )
        return { outcome: 'stale' };
      selectedAccount = update.builder(selectedAccount);
      revision += 1;
      return { outcome: 'commit' };
    });
    const accountMock = jest.requireMock<{
      useActiveAccount: () => { activeAccount: object };
      useSelectedAccount: () => {
        selectedAccount: IAccountSelectorSelectedAccount;
      };
    }>('../../../states/jotai/contexts/accountSelector');
    jest
      .spyOn(accountMock, 'useSelectedAccount')
      .mockImplementation(() => ({ selectedAccount }));
    jest.spyOn(accountMock, 'useActiveAccount').mockImplementation(() => ({
      activeAccount: {
        ready: true,
        wallet: { id: selectedAccount.walletId },
        indexedAccount: { id: selectedAccount.indexedAccountId },
        deriveType: selectedAccount.deriveType,
        network: { id: selectedAccount.networkId },
      },
    }));
    const addressMock = jest.requireMock<{
      useSwapAddressInfo: () => {
        networkId: string;
        accountInfo: { ready: boolean };
      };
    }>('./useSwapAccount');
    jest.spyOn(addressMock, 'useSwapAddressInfo').mockImplementation(() => ({
      networkId: selectedAccount.networkId ?? '',
      accountInfo: { ready: true },
    }));
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each([
    { label: 'Tab', params: {} },
    { label: 'Home More', params: { swapSource: ESwapSource.WALLET_HOME } },
  ])(
    'initializes $label from the current Home selection after API configuration settles',
    async ({ params }) => {
      const request = deferred<ISwapNetwork[]>();
      mockFetchNetworks.mockReturnValue(request.promise);
      renderMarket(params);
      await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalled());
      expectEmptyPair();
      await act(async () => request.resolve([configuredNetwork]));
      await waitFor(() =>
        expect(mockStore.get(swapSelectToTokenAtom())).toEqual(configuredTo),
      );
      expect(selectedAccount.networkId).toBe(homeSelectedAccount.networkId);
      expect(mockStore.get(swapInitialSelectedTokensSyncedAtom())).toBe(true);
      expect(
        mockStore.get(swapSelectedTokensColdStartContextAtom())?.networkId,
      ).toBe(homeSelectedAccount.networkId);
    },
  );

  it.each([false, true])(
    'initializes a cold Stock exit from Home config (recovered after timeout: %s)',
    async (afterTimeout) => {
      await writeContextAtomColdStartCacheValues({
        entries: Object.values(CONTEXT_ATOM_COLD_START_CACHE_KEYS).map(
          (coldStartCacheKey) => ({
            coldStartScopeKey: 'store:swap',
            coldStartCacheKey,
            value: undefined,
          }),
        ),
        flushImmediately: true,
      });
      if (afterTimeout) jest.useFakeTimers();
      const arbHomeInfo = {
        ...homeInfo,
        selectedAccount: { ...homeSelectedAccount, networkId: 'evm--42161' },
      };
      selectedAccount = { ...arbHomeInfo.selectedAccount };
      const arbFrom = {
        ...marketToken,
        networkId: 'evm--42161',
        symbol: 'AAVE',
      };
      const arbTo = {
        ...configuredTo,
        networkId: 'evm--42161',
        contractAddress: '0xusdt',
        symbol: 'USDT',
      };
      const networks = [
        { ...cachedBsc, supportStock: true },
        {
          ...freshNetwork,
          networkId: 'evm--42161',
          defaultSelectTokenDetail: { from: arbFrom, to: arbTo },
        },
      ];
      const request = deferred<ISwapNetwork[]>();
      mockFetchNetworks.mockReturnValue(request.promise);
      jest
        .mocked(getLatestHomeSelectedAccountInfo)
        .mockResolvedValue(arbHomeInfo);
      jest
        .mocked(getHomeSelectedAccountInfoFromContextStore)
        .mockReturnValue(arbHomeInfo);
      mockStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      mockStore.set(swapSelectFromTokenAtom(), bnb);
      mockStore.set(swapSelectToTokenAtom(), {
        ...bnb,
        contractAddress: '0xstock',
        symbol: 'STOCK',
        isStock: true,
      });
      mockStore.set(swapSelectedTokensColdStartContextAtom(), {
        accountKey: 'bootstrap-account',
        networkId: bnb.networkId,
        swapType: ESwapTabSwitchType.STOCK,
        updatedAt: 1,
      });
      mockStore.set(swapInitialSelectedTokensSyncedAtom(), true);
      const view = renderMarket({}, 'store:swap');
      await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalled());
      if (afterTimeout) {
        await act(async () => jest.advanceTimersByTime(2001));
        expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('failed');
      }
      await act(async () => request.resolve(networks));
      await waitFor(() =>
        expect(mockStore.get(swapNetworkConfigStatusAtom())).toBe('success'),
      );
      await waitFor(() => expect(selectedAccount.networkId).toBe('evm--42161'));

      act(() => {
        mockStore.set(swapSelectFromTokenAtom(), undefined);
        mockStore.set(swapSelectToTokenAtom(), undefined);
        mockStore.set(swapSelectedTokensColdStartContextAtom(), undefined);
        mockStore.set(swapInitialSelectedTokensSyncedAtom(), false);
        mockStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
        view.rerender({ swapTabSwitchType: ESwapTabSwitchType.SWAP });
      });

      await waitFor(() =>
        expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(arbFrom),
      );
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(arbTo);
      expect(mockStore.get(swapInitialSelectedTokensSyncedAtom())).toBe(true);
      expect(selectedAccount.networkId).toBe('evm--42161');
      expect(mockFetchNetworks).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps an explicit Stock modal exit outside the Home defaults owner', async () => {
    const stock = { ...marketToken, isStock: true };
    mockFetchNetworks.mockResolvedValue([
      { ...freshNetwork, supportStock: true },
    ]);
    mockStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
    mockStore.set(
      swapSelectFromTokenAtom(),
      swapDefaultSetTokens['evm--1'].fromToken,
    );
    mockStore.set(swapSelectToTokenAtom(), stock);
    mockStore.set(swapInitialSelectedTokensSyncedAtom(), true);
    renderMarket(
      { swapTabSwitchType: ESwapTabSwitchType.STOCK },
      'store:swapModal',
    );
    await waitFor(() =>
      expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('success'),
    );
    const pair = swapDefaultSetTokens['evm--1'];
    act(() => {
      mockStore.set(swapSelectFromTokenAtom(), pair.fromToken);
      mockStore.set(swapSelectToTokenAtom(), pair.toToken);
      mockStore.set(swapSelectedTokensColdStartContextAtom(), undefined);
      mockStore.set(swapInitialSelectedTokensSyncedAtom(), false);
      mockStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
    });
    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(pair.fromToken);
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(pair.toToken);
  });

  it('preserves both token selections after leaving a Stock modal', async () => {
    const stock = { ...marketToken, isStock: true };
    const selectedToken = { ...marketToken, contractAddress: '0xselected' };
    const stockParams: ISwapInitParams = {
      swapSource: ESwapSource.MARKET,
      swapTabSwitchType: ESwapTabSwitchType.STOCK,
      importToToken: stock,
      importFromToken: swapDefaultSetTokens['evm--1'].fromToken,
    };
    mockFetchNetworks.mockResolvedValue([
      { ...freshNetwork, supportStock: true },
    ]);
    mockStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
    mockStore.set(swapSelectToTokenAtom(), stock);
    const view = renderMarket(stockParams, 'store:swapModal');
    await waitFor(() =>
      expect(mockStore.get(swapInitialSelectedTokensSyncedAtom())).toBe(true),
    );
    await waitFor(() =>
      expect(mockStore.get(swapNetworkConfigStatusAtom())).toBe('success'),
    );
    act(() => mockStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK));
    view.rerender(stockParams);
    const pair = swapDefaultSetTokens['evm--1'];
    act(() => {
      mockStore.set(swapSelectFromTokenAtom(), pair.fromToken);
      mockStore.set(swapSelectToTokenAtom(), pair.toToken);
      mockStore.set(swapSelectedTokensColdStartContextAtom(), undefined);
      mockStore.set(swapInitialSelectedTokensSyncedAtom(), false);
      mockStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
    });
    mockIsFocused = false;
    view.rerender(stockParams);
    act(() => mockStore.set(swapSelectFromTokenAtom(), selectedToken));
    mockIsFocused = true;
    view.rerender(stockParams);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(selectedToken);
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(pair.toToken);

    const selectedToToken = { ...selectedToken, contractAddress: '0xother' };
    mockIsFocused = false;
    view.rerender(stockParams);
    const homeRead = deferred<typeof homeInfo>();
    jest.mocked(getLatestHomeSelectedAccountInfo).mockClear();
    jest
      .mocked(getLatestHomeSelectedAccountInfo)
      .mockReturnValueOnce(homeRead.promise);
    act(() => mockStore.set(swapInitialSelectedTokensSyncedAtom(), false));
    mockIsFocused = true;
    view.rerender(stockParams);
    await waitFor(() =>
      expect(getLatestHomeSelectedAccountInfo).toHaveBeenCalled(),
    );
    act(() => mockStore.set(swapSelectToTokenAtom(), selectedToToken));
    await act(async () =>
      homeRead.resolve({
        ...homeInfo,
        selectedAccount: { ...selectedAccount },
        selectedAccountUpdatedAt: revision + 1,
      }),
    );
    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(selectedToken);
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(selectedToToken);
    expect(mockStore.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
  });

  it('does not restore Stock when a tab-only Stock route returns to Swap', async () => {
    const params: ISwapInitParams = {
      swapTabSwitchType: ESwapTabSwitchType.STOCK,
    };
    mockFetchNetworks.mockResolvedValue([
      { ...freshNetwork, supportStock: true },
    ]);
    const view = renderMarket(params, 'store:swapModal');
    await waitFor(() =>
      expect(mockStore.get(swapNetworkConfigStatusAtom())).toBe('success'),
    );
    act(() => mockStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK));
    view.rerender(params);
    const pair = swapDefaultSetTokens['evm--1'];
    act(() => {
      mockStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      mockStore.set(swapSelectFromTokenAtom(), pair.fromToken);
      mockStore.set(swapSelectToTokenAtom(), pair.toToken);
      mockStore.set(swapSelectedTokensColdStartContextAtom(), undefined);
      mockStore.set(swapInitialSelectedTokensSyncedAtom(), false);
    });
    mockIsFocused = false;
    view.rerender(params);
    mockIsFocused = true;
    view.rerender(params);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockStore.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(pair.fromToken);
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(pair.toToken);

    mockIsFocused = false;
    view.rerender(params);
    const previousAccountToken = {
      ...marketToken,
      contractAddress: '0xpreviousaccount',
    };
    act(() => mockStore.set(swapSelectFromTokenAtom(), previousAccountToken));
    jest.mocked(getLatestHomeSelectedAccountInfo).mockResolvedValueOnce({
      ...homeInfo,
      selectedAccount: {
        ...selectedAccount,
        walletId: 'new-wallet',
        indexedAccountId: 'new-account',
      },
      selectedAccountUpdatedAt: revision + 1,
    });
    act(() => mockStore.set(swapInitialSelectedTokensSyncedAtom(), false));
    mockIsFocused = true;
    view.rerender(params);
    await waitFor(() => expect(selectedAccount.walletId).toBe('new-wallet'));
    expect(mockStore.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
    expect(mockStore.get(swapSelectFromTokenAtom())).not.toEqual(
      previousAccountToken,
    );
  });

  it.each(['tokens', 'account', 'home', 'blur', 'unmount'])(
    'rejects the bootstrap when %s changes while reading Home',
    async (change) => {
      const homeRead = deferred<typeof homeInfo>();
      jest
        .mocked(getLatestHomeSelectedAccountInfo)
        .mockReturnValue(homeRead.promise);
      mockFetchNetworks.mockResolvedValue([configuredNetwork]);
      const view = renderMarket({});
      await waitFor(() =>
        expect(getLatestHomeSelectedAccountInfo).toHaveBeenCalled(),
      );
      act(() => {
        if (change === 'tokens')
          mockStore.set(swapSelectFromTokenAtom(), marketToken);
        if (change === 'account')
          selectedAccount = {
            ...selectedAccount,
            indexedAccountId: 'manual-account',
          };
        if (change === 'home')
          jest
            .mocked(getHomeSelectedAccountInfoFromContextStore)
            .mockReturnValue({ ...homeInfo, selectedAccountUpdatedAt: 101 });
        if (change === 'blur') mockIsFocused = false;
      });
      if (change === 'unmount') view.unmount();
      else view.rerender({});
      await act(async () => homeRead.resolve(homeInfo));
      expect(selectedAccount.networkId).toBe('evm--1');
      if (change === 'tokens')
        expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(marketToken);
    },
  );

  it('preserves an amount entered before the default pair is initialized', async () => {
    const homeRead = deferred<typeof homeInfo>();
    jest
      .mocked(getLatestHomeSelectedAccountInfo)
      .mockReturnValue(homeRead.promise);
    mockFetchNetworks.mockResolvedValue([configuredNetwork]);
    renderMarket({});
    await waitFor(() =>
      expect(getLatestHomeSelectedAccountInfo).toHaveBeenCalled(),
    );
    act(() =>
      mockStore.set(swapFromTokenAmountAtom(), { value: '1', isInput: true }),
    );
    await act(async () => homeRead.resolve(homeInfo));
    await waitFor(() =>
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(configuredTo),
    );
    expect(mockStore.get(swapInitialSelectedTokensSyncedAtom())).toBe(true);
    expect(mockStore.get(swapFromTokenAmountAtom())).toEqual({
      value: '1',
      isInput: true,
    });
  });

  it.each([
    { label: 'Tab', networkId: 'onekeyall--0', params: {} },
    {
      label: 'More',
      networkId: 'evm--42161',
      params: {
        swapSource: ESwapSource.WALLET_HOME,
        importNetworkId: 'evm--42161',
      },
    },
    {
      label: 'inline asset',
      networkId: sol.networkId,
      params: {
        swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
        importFromToken: sol,
        importNetworkId: sol.networkId,
      },
    },
  ])(
    'finishes $label with local defaults at two seconds without a network cache',
    async ({ networkId, params }) => {
      jest.useFakeTimers();
      const home = { ...homeSelectedAccount, networkId };
      const info = { ...homeInfo, selectedAccount: home };
      selectedAccount = home;
      jest.mocked(getLatestHomeSelectedAccountInfo).mockResolvedValue(info);
      jest
        .mocked(getHomeSelectedAccountInfoFromContextStore)
        .mockReturnValue(info);
      const request = deferred<ISwapNetwork[]>();
      mockFetchNetworks.mockReturnValue(request.promise);
      const local = swapDefaultSetTokens[networkId];
      renderMarket(params);
      await act(async () => {});
      await act(async () => jest.advanceTimersByTime(1999));
      expect(mockStore.get(swapSelectToTokenAtom())).toBeUndefined();
      await act(async () => jest.advanceTimersByTime(1));
      expect(mockStore.get(swapSelectFromTokenAtom())).toMatchObject({
        networkId: local.fromToken?.networkId,
        contractAddress: local.fromToken?.contractAddress,
      });
      expect(mockStore.get(swapSelectToTokenAtom())).toMatchObject({
        networkId: local.toToken?.networkId,
        contractAddress: local.toToken?.contractAddress,
      });
      expect(mockStore.get(swapInitialSelectedTokensSyncedAtom())).toBe(true);
      const from = mockStore.get(swapSelectFromTokenAtom());
      const to = mockStore.get(swapSelectToTokenAtom());
      await act(async () =>
        request.resolve([
          {
            ...configuredNetwork,
            networkId: local.fromToken?.networkId ?? networkId,
            defaultSelectTokenDetail: {
              from: local.fromToken,
              to: {
                ...configuredTo,
                networkId: local.toToken?.networkId ?? networkId,
              },
            },
          },
        ]),
      );
      expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(from);
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(to);
      expect(mockStore.get(swapDefaultConfigStatusAtom())).toBe('failed');
      expect(mockStore.get(swapNetworkConfigStatusAtom())).toBe('success');
    },
  );

  it('uses recovered configuration for a new route intent without changing the timed-out entry or refetching', async () => {
    jest.useFakeTimers();
    const home = { ...homeSelectedAccount, networkId: 'evm--1' };
    const info = { ...homeInfo, selectedAccount: home };
    jest.mocked(getLatestHomeSelectedAccountInfo).mockResolvedValue(info);
    jest
      .mocked(getHomeSelectedAccountInfoFromContextStore)
      .mockReturnValue(info);
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    const view = renderMarket({
      swapSource: ESwapSource.WALLET_HOME,
      importNetworkId: 'evm--1',
    });
    await act(async () => {});
    await act(async () => jest.advanceTimersByTime(2000));
    const fallbackFrom = mockStore.get(swapSelectFromTokenAtom());
    const fallbackTo = mockStore.get(swapSelectToTokenAtom());
    const arbFrom = {
      ...configuredTo,
      networkId: 'evm--42161',
      contractAddress: '0xaave',
      symbol: 'AAVE',
    };
    const arbTo = {
      ...configuredTo,
      networkId: 'evm--42161',
      contractAddress: '0xusdt',
      symbol: 'USDT',
    };
    await act(async () =>
      request.resolve([
        configuredNetwork,
        {
          ...freshNetwork,
          networkId: 'evm--42161',
          defaultSelectTokenDetail: { from: arbFrom, to: arbTo },
        },
      ]),
    );
    expect(mockStore.get(swapSelectFromTokenAtom())).toEqual(fallbackFrom);
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(fallbackTo);
    selectedAccount = { ...home, networkId: 'evm--42161' };
    const arbInfo = {
      ...info,
      selectedAccount,
      selectedAccountUpdatedAt: 1000,
    };
    jest.mocked(getLatestHomeSelectedAccountInfo).mockResolvedValue(arbInfo);
    jest
      .mocked(getHomeSelectedAccountInfoFromContextStore)
      .mockReturnValue(arbInfo);
    view.rerender({
      swapSource: ESwapSource.WALLET_HOME,
      importNetworkId: 'evm--42161',
    });
    await act(async () => {});
    expect(mockStore.get(swapSelectFromTokenAtom())).toMatchObject(arbFrom);
    expect(mockStore.get(swapSelectToTokenAtom())).toMatchObject(arbTo);
    expect(mockFetchNetworks).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('preserves manual selection made before an asset default times out', async () => {
    jest.useFakeTimers();
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    renderMarket({
      swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
      importFromToken: sol,
    });
    await act(async () => {});
    const manualToken = {
      ...solUsdt,
      contractAddress: 'manual-selected-token',
    };
    act(() => mockStore.set(swapSelectToTokenAtom(), manualToken));
    await act(async () => jest.advanceTimersByTime(2000));
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(manualToken);
    await act(async () => request.resolve([solNetwork]));
    expect(mockStore.get(swapSelectToTokenAtom())).toEqual(manualToken);
  });

  it('completes a Home read started before the empty Swap entry gains focus', async () => {
    const homeRead = deferred<typeof homeInfo>();
    jest
      .mocked(getLatestHomeSelectedAccountInfo)
      .mockReturnValue(homeRead.promise);
    mockFetchNetworks.mockResolvedValue([configuredNetwork]);
    mockIsFocused = false;
    const view = renderMarket({});
    await waitFor(() =>
      expect(getLatestHomeSelectedAccountInfo).toHaveBeenCalled(),
    );
    mockIsFocused = true;
    view.rerender({});
    await act(async () => homeRead.resolve(homeInfo));
    await waitFor(() =>
      expect(mockStore.get(swapSelectToTokenAtom())).toEqual(configuredTo),
    );
    expect(mockStore.get(swapInitialSelectedTokensSyncedAtom())).toBe(true);
  });
});
