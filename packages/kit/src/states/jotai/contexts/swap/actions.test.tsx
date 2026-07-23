/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { useSwapAddressInfo } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapAccount';
import {
  SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER,
  SWAP_PRO_POSITIONS_CACHE_VERSION,
} from '@onekeyhq/kit/src/views/Swap/utils/swapProPositionsCacheUtils';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { settingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import { WALLET_TYPE_EXTERNAL } from '@onekeyhq/shared/src/consts/dbConsts';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IFetchQuoteResult,
  IFetchQuotesParams,
  ISwapNetwork,
  ISwapQuoteEvent,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapActions } from './actions';
import {
  ProviderJotaiContextSwap,
  swapActiveSelectedFromTokenBalanceAtom,
  swapAlertsAtom,
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapLastNonLimitSelectedTokensAtom,
  swapNetworks,
  swapProPositionsCacheAtom,
  swapProPositionsCurrentOwnerKeyAtom,
  swapProPositionsDataOwnerKeyAtom,
  swapProSupportNetworksTokenListAtom,
  swapProTokenBalanceLoadingAtom,
  swapQuoteActionLockAtom,
  swapQuoteCurrentEventProviderKeysAtom,
  swapQuoteCurrentEventReceivedCountAtom,
  swapQuoteCurrentSelectAtom,
  swapQuoteEventCompletedAtom,
  swapQuoteEventErrorAtom,
  swapQuoteEventTotalCountAtom,
  swapQuoteFetchingAtom,
  swapQuoteListAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedFromTokenBalanceAtom,
  swapSelectedTokensColdStartContextAtom,
  swapStockExecutionTokenSyncIdAtom,
  swapStockExecutionTokensAtom,
  swapStockSelectedFromTokenBalanceAtom,
  swapStockSelectedTokenAtom,
  swapToTokenAmountAtom,
  swapTypeSwitchAtom,
  useSwapBalanceDisplayCacheAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapStockSelectedTokenAtom,
} from './atoms';

type IFetchSwapTokenDetailsParams = {
  networkId: string;
  accountAddress?: string;
  accountId?: string;
  contractAddress: string;
  currency?: string;
  direction?: ESwapDirectionType;
};
type ISwapAddressInfo = ReturnType<typeof useSwapAddressInfo>;

const mockFetchSwapTokenDetails: jest.MockedFunction<
  (
    params: IFetchSwapTokenDetailsParams,
  ) => Promise<{ balanceParsed?: string; price?: string; fiatValue?: string }[]>
> = jest.fn();
const mockFetchQuotesEvents: jest.MockedFunction<
  (params: unknown) => Promise<void>
> = jest.fn();
const mockCloseApproving: jest.MockedFunction<() => Promise<void>> = jest.fn();
const mockCancelFetchQuoteEvents: jest.MockedFunction<
  (quoteRequestId?: string) => Promise<void>
> = jest.fn();
const mockCheckAccountNetworkNotSupported: jest.MockedFunction<
  (params: {
    walletId?: string;
    accountId?: string;
    activeNetworkId: string;
  }) => Promise<boolean>
> = jest.fn();
const mockSetSwapNetworksSortRawData: jest.MockedFunction<
  (params: { data: unknown[] }) => Promise<void>
> = jest.fn();
const mockGetSupportSwapAllAccounts: jest.MockedFunction<
  (params: unknown) => Promise<{
    supportAccountsFetchFailed: boolean;
    swapSupportAccounts: {
      apiAddress: string;
      networkId: string;
      accountId: string;
    }[];
  }>
> = jest.fn();
const mockFetchSwapTokens: jest.MockedFunction<
  (params: unknown) => Promise<ISwapToken[]>
> = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchSwapTokens: (params: unknown) => mockFetchSwapTokens(params),
      fetchSwapTokenDetails: (params: IFetchSwapTokenDetailsParams) =>
        mockFetchSwapTokenDetails(params),
      fetchQuotesEvents: (params: unknown) => mockFetchQuotesEvents(params),
      getSupportSwapAllAccounts: (params: unknown) =>
        mockGetSupportSwapAllAccounts(params),
      closeApproving: () => mockCloseApproving(),
      cancelFetchQuoteEvents: (quoteRequestId?: string) =>
        mockCancelFetchQuoteEvents(quoteRequestId),
    },
    simpleDb: {
      swapNetworksSort: {
        setRawData: (params: { data: unknown[] }) =>
          mockSetSwapNetworksSortRawData(params),
      },
    },
    serviceAccount: {
      checkAccountNetworkNotSupported: (params: {
        walletId?: string;
        accountId?: string;
        activeNetworkId: string;
      }) => mockCheckAccountNetworkNotSupported(params),
    },
  },
}));

const ethToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};
const bnbToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '',
  symbol: 'BNB',
  decimals: 18,
  isNative: true,
};
const usdcToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
  isNative: false,
};
const usdtToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdt',
  symbol: 'USDT',
  decimals: 6,
  isNative: false,
};
const stockTokenA: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xstock-a',
  symbol: 'STOCKA',
  decimals: 18,
  isNative: false,
  isStock: true,
};
const appleStockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPL',
  decimals: 18,
  isNative: false,
  isStock: true,
};
const evmSwapNetwork: ISwapNetwork = {
  networkId: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
};
const evmAccount: INetworkAccount = {
  id: 'hd-1--m/44/60/0/0/0',
  name: 'Account 1',
  type: undefined,
  path: "m/44'/60'/0'/0/0",
  coinType: '60',
  impl: 'evm',
  pub: '',
  address: '0xabc',
  addressDetail: {
    isValid: true,
    networkId: 'evm--1',
    address: '0xabc',
    baseAddress: '0xabc',
    normalizedAddress: '0xabc',
    displayAddress: '0xabc',
    allowEmptyAddress: false,
  },
};
const activeAccountInfo: IAccountSelectorActiveAccountInfo = {
  ready: true,
  account: evmAccount,
  indexedAccount: undefined,
  dbAccount: undefined,
  accountName: 'Account 1',
  wallet: undefined,
  device: undefined,
  network: undefined,
  vaultSettings: undefined,
  deriveType: undefined,
  deriveInfoItems: [],
};
const externalWallet: IDBWallet = {
  id: WALLET_TYPE_EXTERNAL,
  name: 'External',
  type: WALLET_TYPE_EXTERNAL,
  backuped: true,
  accounts: [],
  nextIds: {},
  walletNo: 0,
};
const fromAddressInfo: ISwapAddressInfo = {
  address: '0xabc',
  networkId: 'evm--1',
  accountInfo: activeAccountInfo,
  activeAccount: activeAccountInfo,
  isAddressInfoReady: true,
};

function createExternalAddressInfo({
  address,
  isAddressInfoReady,
}: Pick<ISwapAddressInfo, 'address' | 'isAddressInfoReady'>): ISwapAddressInfo {
  return {
    ...fromAddressInfo,
    address,
    networkId: usdtToken.networkId,
    accountInfo: {
      ...activeAccountInfo,
      wallet: externalWallet,
    },
    activeAccount: {
      ...activeAccountInfo,
      wallet: externalWallet,
    },
    isAddressInfoReady,
  };
}

function createWrapperWithStore(
  setup?: (store: ReturnType<typeof createStore>) => void,
) {
  const store = createStore();
  store.set(swapSelectFromTokenAtom(), ethToken);
  store.set(swapNetworks(), [
    {
      networkId: 'evm--1',
      name: 'Ethereum',
      symbol: 'ETH',
      logoURI: '',
      shortcode: 'eth',
      supportSingleSwap: true,
      supportCrossChainSwap: true,
      supportLimit: true,
    },
    {
      networkId: 'evm--56',
      name: 'BNB Smart Chain',
      symbol: 'BNB',
      logoURI: '',
      shortcode: 'bsc',
      supportSingleSwap: true,
      supportCrossChainSwap: true,
      supportStock: true,
    },
  ]);
  setup?.(store);

  function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextSwap store={store}>
        {children}
      </ProviderJotaiContextSwap>
    );
  }

  return { store, Wrapper };
}

async function withMutedConsoleError(fn: () => Promise<void>) {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});
  try {
    await fn();
  } finally {
    consoleErrorSpy.mockRestore();
  }
}

function createWrapper(
  setup?: (store: ReturnType<typeof createStore>) => void,
) {
  return createWrapperWithStore(setup).Wrapper;
}

describe('useSwapActions', () => {
  beforeEach(() => {
    globalJotaiStorageReadyHandler.resolveReady(true);
    jest.clearAllMocks();
    mockSetSwapNetworksSortRawData.mockResolvedValue(undefined);
    mockCloseApproving.mockResolvedValue(undefined);
    mockCancelFetchQuoteEvents.mockResolvedValue(undefined);
    mockCheckAccountNetworkNotSupported.mockResolvedValue(false);
    mockFetchQuotesEvents.mockResolvedValue(undefined);
    mockFetchSwapTokens.mockResolvedValue([]);
    mockGetSupportSwapAllAccounts.mockResolvedValue({
      supportAccountsFetchFailed: false,
      swapSupportAccounts: [],
    });
    jest.spyOn(settingsAtom, 'get').mockResolvedValue({
      swapEnableRecipientAddress: false,
      swapIncognitoMode: false,
      swapSlippagePercentageCustomValue: 0,
      swapSlippagePercentageMode: ESwapSlippageSegmentKey.AUTO,
      swapToAnotherAccountSwitchOn: false,
    });
  });

  it('pins selected token detail price fetches to USD for rate-difference math', async () => {
    mockFetchSwapTokenDetails.mockResolvedValue([
      {
        balanceParsed: '1.23',
        price: '3000',
        fiatValue: '3690',
      },
    ]);

    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [balanceDisplayCache] = useSwapBalanceDisplayCacheAtom();
        const [fromToken] = useSwapSelectFromTokenAtom();
        const [balance] = useSwapSelectedFromTokenBalanceAtom();

        return {
          actions,
          balanceDisplayCache,
          fromToken,
          balance,
        };
      },
      {
        wrapper: createWrapper(),
      },
    );

    await act(async () => {
      await result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        fromAddressInfo,
      );
    });

    expect(mockFetchSwapTokenDetails).toHaveBeenCalledWith({
      networkId: 'evm--1',
      accountAddress: '0xabc',
      accountId: 'hd-1--m/44/60/0/0/0',
      contractAddress: '',
      direction: ESwapDirectionType.FROM,
      currency: 'usd',
    });
    expect(result.current.fromToken?.price).toBe('3000');
    expect(result.current.fromToken?.currency).toBe('usd');
    expect(result.current.balance).toBe('1.23');
    expect(result.current.balanceDisplayCache.entries[0]).toMatchObject({
      accountAddress: '0xabc',
      balance: '1.23',
      contractAddress: '',
      isNative: true,
      networkId: 'evm--1',
    });
  });

  it('does not persist an error fallback as a display balance', async () => {
    mockFetchSwapTokenDetails.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [balanceDisplayCache] = useSwapBalanceDisplayCacheAtom();
        const [balance] = useSwapSelectedFromTokenBalanceAtom();
        return {
          actions,
          balance,
          balanceDisplayCache,
        };
      },
      {
        wrapper: createWrapper(),
      },
    );

    await act(async () => {
      await result.current.actions.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        fromAddressInfo,
      );
    });

    expect(result.current.balance).toBe('0.0');
    expect(result.current.balanceDisplayCache.entries).toEqual([]);
  });

  it('does not let the ordinary Swap balance loader run for Stock tokens', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), {
        ...ethToken,
        symbol: 'USDT',
        balanceParsed: '2.2279',
      });
      storeInstance.set(swapSelectedFromTokenBalanceAtom(), '0.01001');
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.loadSwapSelectTokenDetail(
        ESwapDirectionType.FROM,
        fromAddressInfo,
      );
    });

    expect(mockFetchSwapTokenDetails).not.toHaveBeenCalled();
    expect(store.get(swapSelectedFromTokenBalanceAtom())).toBe('0.01001');
  });

  it('keeps the latest Stock execution token sync when network sorting resolves out of order', async () => {
    let resolveFirstSort: (() => void) | undefined;
    mockSetSwapNetworksSortRawData
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstSort = resolve;
          }),
      )
      .mockResolvedValue(undefined);

    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [fromToken] = useSwapSelectFromTokenAtom();
        const [toToken] = useSwapSelectToTokenAtom();
        const [stockSelectedToken] = useSwapStockSelectedTokenAtom();

        return {
          actions,
          fromToken,
          stockSelectedToken,
          toToken,
        };
      },
      {
        wrapper: createWrapper(),
      },
    );

    await act(async () => {
      const firstSync = result.current.actions.selectStockExecutionTokens({
        fromToken: usdcToken,
        toToken: stockTokenA,
        syncId: 1,
      });
      await Promise.resolve();

      await result.current.actions.selectStockExecutionTokens({
        fromToken: usdtToken,
        toToken: appleStockToken,
        syncId: 2,
      });

      resolveFirstSort?.();
      await firstSync;
    });

    expect(result.current.fromToken).toMatchObject({
      symbol: 'USDT',
      contractAddress: '0xusdt',
    });
    expect(result.current.toToken).toMatchObject({
      symbol: 'AAPL',
      contractAddress: '0xaapl',
    });
    expect(result.current.stockSelectedToken).toMatchObject({
      symbol: 'AAPL',
      contractAddress: '0xaapl',
    });
  });

  it('does not clear the Stock selected owner on a pay-token-only execution sync', async () => {
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;
        const [stockSelectedToken] = useSwapStockSelectedTokenAtom();

        return {
          actions,
          stockSelectedToken,
        };
      },
      {
        wrapper: createWrapper((storeInstance) => {
          storeInstance.set(swapStockSelectedTokenAtom(), stockTokenA);
        }),
      },
    );

    await act(async () => {
      await result.current.actions.selectStockExecutionTokens({
        fromToken: usdcToken,
        syncId: 1,
      });
    });

    expect(result.current.stockSelectedToken).toBe(stockTokenA);
  });

  it('checks warnings for a current-event quote while providers are still fetching', async () => {
    const fromToken = {
      ...ethToken,
      price: '100',
      currency: 'usd',
    };
    const toToken = {
      ...usdcToken,
      price: '100',
      currency: 'usd',
    };
    const quote = {
      eventId: 'event-warning',
      quoteId: 'quote-warning',
      fromAmount: '1',
      toAmount: '1.2',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.SWAP,
      instantRate: '1.2',
      fromTokenInfo: fromToken,
      toTokenInfo: toToken,
      info: {
        provider: 'mock',
        providerName: 'mock',
      },
    } as IFetchQuoteResult;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapSelectFromTokenAtom(), fromToken);
      storeInstance.set(swapSelectToTokenAtom(), toToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
      storeInstance.set(swapQuoteListAtom(), [quote]);
      storeInstance.set(swapQuoteEventTotalCountAtom(), {
        eventId: 'event-warning',
        count: 2,
      });
      storeInstance.set(swapQuoteCurrentEventProviderKeysAtom(), ['mock-mock']);
      storeInstance.set(swapQuoteCurrentEventReceivedCountAtom(), 1);
      storeInstance.set(swapQuoteEventCompletedAtom(), false);
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );

    await act(async () => {
      await result.current.actions.checkSwapWarning(
        fromAddressInfo,
        fromAddressInfo,
        { allowNoConnectWallet: true },
      );
    });

    expect(store.get(swapAlertsAtom())).toMatchObject({
      quoteId: 'quote-warning',
      states: [
        {
          noConnectWallet: true,
        },
      ],
    });
  });

  it('ignores stale Stock quote limits when the current input amount changed', async () => {
    const quote = {
      quoteId: 'stale-stock-limit-quote',
      fromAmount: '2',
      toAmount: '0',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.STOCK,
      fromTokenInfo: usdcToken,
      toTokenInfo: appleStockToken,
      limit: {
        min: '10',
      },
      info: {
        provider: 'mock',
        providerName: 'mock',
      },
    } as IFetchQuoteResult;
    const connectedAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      networkId: usdcToken.networkId,
      accountInfo: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
      activeAccount: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteListAtom(), [quote]);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          connectedAddressInfo,
          connectedAddressInfo,
          { allowNoConnectWallet: true },
        );
      });
    });

    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
  });

  it('does not write Stock quote min limits as generic red swap alerts', async () => {
    const quote = {
      quoteId: 'current-stock-limit-quote',
      fromAmount: '1',
      toAmount: '0',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.STOCK,
      fromTokenInfo: usdcToken,
      toTokenInfo: appleStockToken,
      limit: {
        min: '10',
      },
      info: {
        provider: 'mock',
        providerName: 'mock',
      },
    } as IFetchQuoteResult;
    const connectedAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      networkId: usdcToken.networkId,
      accountInfo: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
      activeAccount: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
      storeInstance.set(swapQuoteListAtom(), [quote]);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          connectedAddressInfo,
          connectedAddressInfo,
          { allowNoConnectWallet: true },
        );
      });
    });

    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: 'current-stock-limit-quote',
      states: [],
    });
  });

  it('does not write stale Stock quote limit alerts after the amount changes mid-check', async () => {
    const quote = {
      quoteId: 'async-stale-stock-limit-quote',
      fromAmount: '1',
      toAmount: '0',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.STOCK,
      fromTokenInfo: usdcToken,
      toTokenInfo: appleStockToken,
      limit: {
        min: '10',
      },
      info: {
        provider: 'mock',
        providerName: 'mock',
      },
    } as IFetchQuoteResult;
    const connectedAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      networkId: usdcToken.networkId,
      accountInfo: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
      activeAccount: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
      storeInstance.set(swapQuoteListAtom(), [quote]);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    const settings = {
      swapEnableRecipientAddress: false,
      swapIncognitoMode: false,
      swapSlippagePercentageCustomValue: 0,
      swapSlippagePercentageMode: ESwapSlippageSegmentKey.AUTO,
      swapToAnotherAccountSwitchOn: false,
    };
    let resolveSettings: (value: typeof settings) => void = () => {};
    const settingsGetMock = settingsAtom.get as jest.MockedFunction<
      typeof settingsAtom.get
    >;
    settingsGetMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSettings = resolve;
        }),
    );

    const warningPromise = result.current.checkSwapWarning(
      connectedAddressInfo,
      connectedAddressInfo,
      { allowNoConnectWallet: true },
    );
    store.set(swapFromTokenAmountAtom(), {
      value: '0.0',
      isInput: true,
    });

    await act(async () => {
      resolveSettings(settings);
      await warningPromise;
    });

    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
  });

  it('clears stale Stock quote event errors when the current input amount changed', async () => {
    const connectedAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      networkId: usdcToken.networkId,
      accountInfo: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
      activeAccount: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteEventErrorAtom(), {
        message: 'Min amount/request 10 USDC',
        fromToken: usdcToken,
        toToken: appleStockToken,
        fromTokenAmount: '2',
        isStock: true,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          connectedAddressInfo,
          connectedAddressInfo,
          { allowNoConnectWallet: true },
        );
      });
    });

    expect(store.get(swapQuoteEventErrorAtom())).toBeUndefined();
    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
  });

  it('does not write current Stock quote event errors as generic red swap alerts', async () => {
    const connectedAddressInfo: ISwapAddressInfo = {
      ...fromAddressInfo,
      networkId: usdcToken.networkId,
      accountInfo: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
      activeAccount: {
        ...activeAccountInfo,
        wallet: externalWallet,
      },
    };
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteEventErrorAtom(), {
        message: 'Market is closed',
        fromToken: usdcToken,
        toToken: appleStockToken,
        fromTokenAmount: '21',
        isStock: true,
        isMarketOpen: false,
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          connectedAddressInfo,
          connectedAddressInfo,
          { allowNoConnectWallet: true },
        );
      });
    });

    expect(store.get(swapQuoteEventErrorAtom())).toEqual(
      expect.objectContaining({
        message: 'Market is closed',
        isStock: true,
        isMarketOpen: false,
      }),
    );
    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
  });

  it('clears stale Stock quote alerts when quote state is reset', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '0.0',
        isInput: true,
      });
      storeInstance.set(swapAlertsAtom(), {
        quoteId: '',
        states: [
          {
            message: 'Min amount/request 10 USDC',
            alertLevel: undefined,
          },
        ],
      });
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.resetQuoteAction();
    });

    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
  });

  it('keeps Stock current quote selected when service normalizes amount formatting', () => {
    const quote = {
      quoteId: 'stock-numeric-match-quote',
      fromAmount: '1000',
      toAmount: '10',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.STOCK,
      fromTokenInfo: usdcToken,
      toTokenInfo: appleStockToken,
      info: {
        provider: 'mock',
        providerName: 'mock',
      },
    } as IFetchQuoteResult;
    const { store } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1000.0',
        isInput: true,
      });
      storeInstance.set(swapToTokenAmountAtom(), {
        value: '',
        isInput: false,
      });
      storeInstance.set(swapQuoteListAtom(), [quote]);
    });

    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      'stock-numeric-match-quote',
    );
  });

  it('keeps previous Stock provider quotes display-only when amount formatting is normalized', async () => {
    const oldQuote = {
      quoteId: 'old-stock-provider-quote',
      eventId: 'previous-event',
      fromAmount: '1000',
      // Keep the previous quote more attractive so the test proves that it
      // cannot become executable merely because it is retained for display.
      toAmount: '99',
      kind: ESwapQuoteKind.SELL,
      protocol: EProtocolOfExchange.STOCK,
      fromTokenInfo: usdcToken,
      toTokenInfo: appleStockToken,
      info: {
        provider: 'old-provider',
        providerName: 'Old Provider',
      },
    } as IFetchQuoteResult;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1000.0',
        isInput: true,
      });
      storeInstance.set(swapQuoteEventTotalCountAtom(), {
        eventId: 'normalized-event',
        count: 2,
      });
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId: 'normalized-request',
      });
      storeInstance.set(swapQuoteListAtom(), [oldQuote]);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    const quoteEvent = {
      data: JSON.stringify({
        data: [
          {
            quoteId: 'new-stock-provider-quote',
            eventId: 'normalized-event',
            info: {
              provider: 'new-provider',
              providerName: 'New Provider',
            },
            fromAmount: '1000',
            fromTokenInfo: usdcToken,
            toAmount: '10.1',
            toTokenInfo: appleStockToken,
            protocol: EProtocolOfExchange.STOCK,
          },
        ],
      }),
    } as ISwapQuoteEvent;
    const quoteParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '1000.0',
      protocol: EProtocolOfExchange.STOCK,
      slippagePercentage: 0.5,
      toNetworkId: appleStockToken.networkId,
      toTokenAddress: appleStockToken.contractAddress,
    };
    const tokenPairs = {
      fromToken: usdcToken,
      toToken: appleStockToken,
    };

    await act(async () => {
      result.current.quoteEventHandler({
        event: quoteEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'normalized-request',
        tokenPairs,
      });
    });

    expect(store.get(swapQuoteListAtom())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventId: 'normalized-event',
          quoteId: 'old-stock-provider-quote',
        }),
        expect.objectContaining({
          eventId: 'normalized-event',
          quoteId: 'new-stock-provider-quote',
        }),
      ]),
    );
    expect(store.get(swapQuoteCurrentEventProviderKeysAtom())).toEqual([
      'new-provider-New Provider',
    ]);
    expect(store.get(swapQuoteCurrentEventReceivedCountAtom())).toBe(1);
    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      'new-stock-provider-quote',
    );

    await act(async () => {
      result.current.quoteEventHandler({
        event: {} as ISwapQuoteEvent,
        type: 'done',
        params: quoteParams,
        quoteRequestId: 'normalized-request',
        tokenPairs,
      });
    });

    expect(store.get(swapQuoteEventCompletedAtom())).toBe(true);
    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      'new-stock-provider-quote',
    );
  });

  it('restores Limit defaults after leaving Stock with cleared tokens', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );

    await act(async () => {
      await result.current.actions.resetSwapTokenData(ESwapDirectionType.FROM);
      await result.current.actions.resetSwapTokenData(ESwapDirectionType.TO);
      await result.current.actions.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        'evm--56',
      );
    });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
    expect(store.get(swapSelectFromTokenAtom())).toEqual(
      expect.objectContaining({
        networkId: 'evm--1',
        contractAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        symbol: 'WETH',
      }),
    );
    expect(store.get(swapSelectToTokenAtom())).toEqual(
      expect.objectContaining({
        networkId: 'evm--1',
        contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        symbol: 'USDC',
      }),
    );
  });

  it('does not carry Stock selected tokens through a direct Limit switch', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
      storeInstance.set(swapStockSelectedFromTokenBalanceAtom(), '999');
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '10',
        isInput: true,
      });
      storeInstance.set(swapSelectedTokensColdStartContextAtom(), {
        accountKey: 'test-account',
        networkId: 'evm--56',
        swapType: ESwapTabSwitchType.STOCK,
        updatedAt: 1,
      });
      storeInstance.set(swapInitialSelectedTokensSyncedAtom(), true);
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );

    await act(async () => {
      await result.current.actions.swapTypeSwitchAction(
        ESwapTabSwitchType.LIMIT,
        'evm--56',
      );
    });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
    expect(store.get(swapSelectFromTokenAtom())).toEqual(
      expect.objectContaining({
        networkId: 'evm--1',
        symbol: 'WETH',
      }),
    );
    expect(store.get(swapSelectToTokenAtom())).toEqual(
      expect.objectContaining({
        networkId: 'evm--1',
        symbol: 'USDC',
      }),
    );
    expect(store.get(swapSelectedTokensColdStartContextAtom())).toBeUndefined();
    expect(store.get(swapInitialSelectedTokensSyncedAtom())).toBe(false);
    expect(store.get(swapLastNonLimitSelectedTokensAtom())).toBeUndefined();
    expect(store.get(swapSelectedFromTokenBalanceAtom())).toBe('');
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('');

    await act(async () => {
      await result.current.actions.swapTypeSwitchAction(
        ESwapTabSwitchType.SWAP,
        'evm--56',
      );
    });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
    expect(store.get(swapSelectFromTokenAtom())).not.toMatchObject({
      contractAddress: usdcToken.contractAddress,
    });
    expect(store.get(swapSelectToTokenAtom())).not.toMatchObject({
      contractAddress: appleStockToken.contractAddress,
    });
  });

  it('restores the previous Swap pair without exposing the Stock balance', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
      storeInstance.set(swapSelectedFromTokenBalanceAtom(), '0.1724');
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );

    await act(async () => {
      await result.current.actions.swapTypeSwitchAction(
        ESwapTabSwitchType.STOCK,
        'evm--56',
      );
    });

    expect(store.get(swapSelectedFromTokenBalanceAtom())).toBe('0.1724');
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('');
    expect(store.get(swapActiveSelectedFromTokenBalanceAtom())).toBe('');

    store.set(swapSelectFromTokenAtom(), usdcToken);
    store.set(swapSelectToTokenAtom(), appleStockToken);
    store.set(swapStockSelectedFromTokenBalanceAtom(), '999');
    expect(store.get(swapActiveSelectedFromTokenBalanceAtom())).toBe('999');

    await act(async () => {
      await result.current.actions.swapTypeSwitchAction(
        ESwapTabSwitchType.SWAP,
        'evm--56',
      );
    });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
    expect(store.get(swapSelectFromTokenAtom())).toEqual(
      expect.objectContaining({
        networkId: bnbToken.networkId,
        contractAddress: bnbToken.contractAddress,
        symbol: bnbToken.symbol,
      }),
    );
    expect(store.get(swapSelectToTokenAtom())).toEqual(usdtToken);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapSelectedFromTokenBalanceAtom())).toBe('0.1724');
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('');
    expect(store.get(swapActiveSelectedFromTokenBalanceAtom())).toBe('0.1724');

    store.set(swapStockSelectedFromTokenBalanceAtom(), '999');
    expect(store.get(swapActiveSelectedFromTokenBalanceAtom())).toBe('0.1724');
  });

  it('blocks Stock quote before Stock execution tokens own the selected pair', async () => {
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: createWrapper((store) => {
          store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
          store.set(swapSelectFromTokenAtom(), ethToken);
          store.set(swapSelectToTokenAtom(), usdcToken);
          store.set(swapFromTokenAmountAtom(), { value: '1', isInput: true });
        }),
      },
    );

    await act(async () => {
      await result.current.actions.quoteAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        evmAccount.id,
        undefined,
        undefined,
        ESwapQuoteKind.SELL,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchQuotesEvents).not.toHaveBeenCalled();
  });

  it('runs Stock quote events after Stock execution tokens own the selected pair', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapStockExecutionTokenSyncIdAtom(), 1);
      storeInstance.set(swapStockExecutionTokensAtom(), {
        syncId: 1,
        fromToken: usdcToken,
        toToken: stockTokenA,
      });
      storeInstance.set(swapStockSelectedTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.STOCK);
    expect(store.get(swapSelectFromTokenAtom())).toBe(usdcToken);
    expect(store.get(swapSelectToTokenAtom())).toBe(stockTokenA);
    expect(store.get(swapStockExecutionTokenSyncIdAtom())).toBe(1);
    expect(store.get(swapStockExecutionTokensAtom())).toEqual({
      syncId: 1,
      fromToken: usdcToken,
      toToken: stockTokenA,
    });
    expect(store.get(swapStockSelectedTokenAtom())).toBe(stockTokenA);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '1',
      isInput: true,
    });

    await act(async () => {
      await result.current.actions.quoteAction(
        { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
        '0xabc',
        evmAccount.id,
        undefined,
        undefined,
        ESwapQuoteKind.SELL,
      );
    });

    expect(store.get(swapQuoteActionLockAtom())).toEqual(
      expect.objectContaining({
        accountId: evmAccount.id,
        actionLock: true,
        address: '0xabc',
        fromToken: usdcToken,
        fromTokenAmount: '1',
        kind: ESwapQuoteKind.SELL,
        quoteRequestId: expect.any(String),
        toToken: stockTokenA,
        toTokenAmount: '',
        type: ESwapTabSwitchType.STOCK,
      }),
    );
    const quoteRequestId = store.get(swapQuoteActionLockAtom()).quoteRequestId;

    await waitFor(() =>
      expect(mockFetchQuotesEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: evmAccount.id,
          autoSlippage: true,
          fromToken: usdcToken,
          fromTokenAmount: '1',
          incognito: false,
          protocol: ESwapTabSwitchType.STOCK,
          quoteRequestId,
          slippagePercentage: 0.5,
          toToken: stockTokenA,
          userAddress: '0xabc',
        }),
      ),
    );
  });

  it('normalizes quote event results with the dispatch-time input amount', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '1',
        isInput: true,
      });
      storeInstance.set(swapQuoteEventTotalCountAtom(), {
        eventId: 'event-1',
        count: 1,
      });
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId: 'event-1-request',
      });
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );

    const quoteEvent = {
      data: JSON.stringify({
        data: [
          {
            eventId: 'event-1',
            info: {
              provider: 'stock',
              providerName: 'Stock',
            },
            fromTokenInfo: usdcToken,
            toAmount: '10',
            toTokenInfo: stockTokenA,
            protocol: EProtocolOfExchange.STOCK,
          },
        ],
      }),
    } as ISwapQuoteEvent;
    const quoteParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '1',
      protocol: EProtocolOfExchange.STOCK,
      slippagePercentage: 0.5,
      toNetworkId: stockTokenA.networkId,
      toTokenAddress: stockTokenA.contractAddress,
    };

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: quoteEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'event-1-request',
        tokenPairs: {
          fromToken: usdcToken,
          toToken: stockTokenA,
        },
      });
    });

    expect(store.get(swapQuoteListAtom())[0]).toEqual(
      expect.objectContaining({
        fromAmount: '1',
      }),
    );
  });

  it('accepts the current Swap quote before total and ignores stale request events', async () => {
    const staleQuote = {
      quoteId: 'stale-swap-quote',
      eventId: 'stale-swap-event',
      info: {
        provider: 'stale-provider',
        providerName: 'Stale Provider',
      },
      fromAmount: '2',
      fromTokenInfo: usdcToken,
      toAmount: '1',
      toTokenInfo: usdtToken,
      protocol: EProtocolOfExchange.SWAP,
      kind: ESwapQuoteKind.SELL,
    } as IFetchQuoteResult;
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteListAtom(), [staleQuote]);
      storeInstance.set(swapQuoteEventTotalCountAtom(), { count: 0 });
      storeInstance.set(swapQuoteFetchingAtom(), true);
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        type: ESwapTabSwitchType.SWAP,
        fromToken: usdcToken,
        toToken: usdtToken,
        fromTokenAmount: '21',
        toTokenAmount: '',
        kind: ESwapQuoteKind.SELL,
        quoteRequestId: 'current-swap-request',
      });
    });
    const { result } = renderHook(
      () => ({ actions: useSwapActions().current }),
      { wrapper: Wrapper },
    );
    const staleParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '21',
      protocol: EProtocolOfExchange.SWAP,
      slippagePercentage: 0.5,
      toNetworkId: usdtToken.networkId,
      toTokenAddress: usdtToken.contractAddress,
    };

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: {} as ISwapQuoteEvent,
        type: 'done',
        params: staleParams,
        quoteRequestId: 'stale-swap-request',
        tokenPairs: { fromToken: usdcToken, toToken: usdtToken },
      });
    });

    expect(store.get(swapQuoteEventCompletedAtom())).toBe(false);
    expect(store.get(swapQuoteFetchingAtom())).toBe(true);
    expect(store.get(swapQuoteActionLockAtom()).actionLock).toBe(true);
    expect(mockCancelFetchQuoteEvents).not.toHaveBeenCalled();

    const currentQuoteEvent = {
      data: JSON.stringify({
        data: [
          {
            quoteId: 'current-swap-quote',
            eventId: 'current-swap-event',
            info: {
              provider: 'current-provider',
              providerName: 'Current Provider',
            },
            fromAmount: '21',
            fromTokenInfo: usdcToken,
            toAmount: '10',
            toTokenInfo: usdtToken,
            protocol: EProtocolOfExchange.SWAP,
            kind: ESwapQuoteKind.SELL,
          },
        ],
      }),
    } as ISwapQuoteEvent;
    const currentParams: IFetchQuotesParams = staleParams;

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: currentQuoteEvent,
        type: 'message',
        params: currentParams,
        quoteRequestId: 'current-swap-request',
        tokenPairs: { fromToken: usdcToken, toToken: usdtToken },
      });
    });

    expect(store.get(swapQuoteEventTotalCountAtom())).toEqual({
      eventId: 'current-swap-event',
      count: 1,
      totalQuoteCountReceived: false,
    });
    expect(store.get(swapQuoteCurrentEventProviderKeysAtom())).toEqual([
      'current-provider-Current Provider',
    ]);
    expect(store.get(swapQuoteCurrentEventReceivedCountAtom())).toBe(1);
    expect(store.get(swapQuoteCurrentSelectAtom())).toEqual(
      expect.objectContaining({
        eventId: 'current-swap-event',
        fromAmount: '21',
        quoteId: 'current-swap-quote',
      }),
    );
    expect(store.get(swapQuoteFetchingAtom())).toBe(false);
    expect(store.get(swapQuoteEventCompletedAtom())).toBe(false);
  });

  it.each([
    {
      caseName: 'Limit rejects a Swap completion',
      currentSwapType: ESwapTabSwitchType.LIMIT,
      eventProtocol: EProtocolOfExchange.SWAP,
      fromToken: usdcToken,
      toToken: usdtToken,
      inputKind: ESwapQuoteKind.BUY,
      currentFromAmount: '5',
      currentToAmount: '21',
      requestFromAmount: '5',
      requestToAmount: '21',
      shouldAccept: false,
    },
    {
      caseName: 'Swap rejects a Limit completion',
      currentSwapType: ESwapTabSwitchType.SWAP,
      eventProtocol: EProtocolOfExchange.LIMIT,
      fromToken: usdcToken,
      toToken: usdtToken,
      inputKind: ESwapQuoteKind.SELL,
      currentFromAmount: '21',
      currentToAmount: '5',
      requestFromAmount: '21',
      requestToAmount: '5',
      shouldAccept: false,
    },
    {
      caseName: 'Bridge rejects a stale input completion',
      currentSwapType: ESwapTabSwitchType.BRIDGE,
      eventProtocol: EProtocolOfExchange.SWAP,
      fromToken: ethToken,
      toToken: bnbToken,
      inputKind: ESwapQuoteKind.SELL,
      currentFromAmount: '21',
      currentToAmount: '5',
      requestFromAmount: '2',
      requestToAmount: '5',
      shouldAccept: false,
    },
    {
      caseName: 'Limit accepts the current BUY input completion',
      currentSwapType: ESwapTabSwitchType.LIMIT,
      eventProtocol: EProtocolOfExchange.LIMIT,
      fromToken: usdcToken,
      toToken: usdtToken,
      inputKind: ESwapQuoteKind.BUY,
      currentFromAmount: '999',
      currentToAmount: '21',
      requestFromAmount: '5',
      requestToAmount: '21',
      shouldAccept: true,
    },
  ])(
    '$caseName',
    async ({
      currentSwapType,
      eventProtocol,
      fromToken,
      toToken,
      inputKind,
      currentFromAmount,
      currentToAmount,
      requestFromAmount,
      requestToAmount,
      shouldAccept,
    }) => {
      const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
        storeInstance.set(swapTypeSwitchAtom(), currentSwapType);
        storeInstance.set(swapSelectFromTokenAtom(), fromToken);
        storeInstance.set(swapSelectToTokenAtom(), toToken);
        storeInstance.set(swapFromTokenAmountAtom(), {
          value: currentFromAmount,
          isInput: inputKind === ESwapQuoteKind.SELL,
        });
        storeInstance.set(swapToTokenAmountAtom(), {
          value: currentToAmount,
          isInput: inputKind === ESwapQuoteKind.BUY,
        });
        storeInstance.set(swapQuoteEventCompletedAtom(), false);
        storeInstance.set(swapQuoteFetchingAtom(), true);
        storeInstance.set(swapQuoteActionLockAtom(), {
          actionLock: true,
          quoteRequestId: 'completion-request',
        });
      });
      const { result } = renderHook(
        () => ({ actions: useSwapActions().current }),
        { wrapper: Wrapper },
      );
      const params: IFetchQuotesParams = {
        fromNetworkId: fromToken.networkId,
        fromTokenAddress: fromToken.contractAddress,
        fromTokenAmount: requestFromAmount,
        protocol: eventProtocol,
        slippagePercentage: 0.5,
        toNetworkId: toToken.networkId,
        toTokenAddress: toToken.contractAddress,
        toTokenAmount: requestToAmount,
        kind: inputKind,
      };

      await act(async () => {
        result.current.actions.quoteEventHandler({
          event: {} as ISwapQuoteEvent,
          type: 'done',
          params,
          quoteRequestId: 'completion-request',
          tokenPairs: { fromToken, toToken },
        });
      });

      expect(store.get(swapQuoteEventCompletedAtom())).toBe(shouldAccept);
      expect(store.get(swapQuoteFetchingAtom())).toBe(!shouldAccept);
    },
  );

  it('accepts native Pro LIMIT events using the dispatched request tokens', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
      storeInstance.set(swapSelectFromTokenAtom(), ethToken);
      storeInstance.set(swapSelectToTokenAtom(), bnbToken);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '999',
        isInput: false,
      });
      storeInstance.set(swapToTokenAmountAtom(), {
        value: '999',
        isInput: false,
      });
      storeInstance.set(swapQuoteEventCompletedAtom(), false);
      storeInstance.set(swapQuoteFetchingAtom(), true);
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId: 'pro-limit-request',
        type: ESwapTabSwitchType.LIMIT,
        fromToken: usdcToken,
        toToken: usdtToken,
        fromTokenAmount: '5',
        toTokenAmount: '21',
        kind: ESwapQuoteKind.BUY,
      });
    });
    const { result } = renderHook(
      () => ({ actions: useSwapActions().current }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: {} as ISwapQuoteEvent,
        type: 'done',
        params: {
          fromNetworkId: usdcToken.networkId,
          fromTokenAddress: usdcToken.contractAddress,
          fromTokenAmount: '5',
          protocol: EProtocolOfExchange.LIMIT,
          slippagePercentage: 0.5,
          toNetworkId: usdtToken.networkId,
          toTokenAddress: usdtToken.contractAddress,
          toTokenAmount: '21',
          kind: ESwapQuoteKind.BUY,
        },
        quoteRequestId: 'pro-limit-request',
        tokenPairs: { fromToken: usdcToken, toToken: usdtToken },
      });
    });

    expect(store.get(swapQuoteEventCompletedAtom())).toBe(true);
    expect(store.get(swapQuoteFetchingAtom())).toBe(false);
  });

  it('accepts Stock quote event results before the total count event arrives', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId: 'early-stock-request',
      });
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );
    const quoteEvent = {
      data: JSON.stringify({
        data: [
          {
            quoteId: 'early-stock-quote',
            eventId: 'early-stock-event',
            info: {
              provider: 'stock',
              providerName: 'Stock',
            },
            fromTokenInfo: usdcToken,
            toAmount: '0.0683',
            toTokenInfo: stockTokenA,
            protocol: EProtocolOfExchange.STOCK,
          },
        ],
      }),
    } as ISwapQuoteEvent;
    const quoteParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '21',
      protocol: EProtocolOfExchange.STOCK,
      slippagePercentage: 0.5,
      toNetworkId: stockTokenA.networkId,
      toTokenAddress: stockTokenA.contractAddress,
      toTokenAmount: '',
    };

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: quoteEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'early-stock-request',
        tokenPairs: {
          fromToken: usdcToken,
          toToken: stockTokenA,
        },
      });
    });

    expect(store.get(swapQuoteEventTotalCountAtom())).toEqual({
      eventId: 'early-stock-event',
      count: 1,
      totalQuoteCountReceived: false,
    });
    expect(store.get(swapQuoteCurrentEventReceivedCountAtom())).toBe(1);
    expect(store.get(swapQuoteListAtom())[0]).toEqual(
      expect.objectContaining({
        fromAmount: '21',
        quoteId: 'early-stock-quote',
      }),
    );
    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      'early-stock-quote',
    );

    store.set(swapToTokenAmountAtom(), {
      value: '0.0683',
      isInput: false,
    });

    const totalCountEvent = {
      data: JSON.stringify({
        eventId: 'early-stock-event',
        totalQuoteCount: 3,
      }),
    } as ISwapQuoteEvent;
    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: totalCountEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'early-stock-request',
        tokenPairs: {
          fromToken: usdcToken,
          toToken: stockTokenA,
        },
      });
    });

    expect(store.get(swapQuoteEventTotalCountAtom())).toEqual({
      eventId: 'early-stock-event',
      count: 3,
      totalQuoteCountReceived: true,
    });
    expect(store.get(swapQuoteCurrentEventReceivedCountAtom())).toBe(1);
    expect(store.get(swapQuoteCurrentSelectAtom())?.quoteId).toBe(
      'early-stock-quote',
    );

    const secondProviderQuoteEvent = {
      data: JSON.stringify({
        data: [
          {
            quoteId: 'second-stock-quote',
            eventId: 'early-stock-event',
            info: {
              provider: 'stock-second',
              providerName: 'Stock Second',
            },
            fromTokenInfo: usdcToken,
            toAmount: '0.069',
            toTokenInfo: stockTokenA,
            protocol: EProtocolOfExchange.STOCK,
          },
        ],
      }),
    } as ISwapQuoteEvent;
    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: secondProviderQuoteEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'early-stock-request',
        tokenPairs: {
          fromToken: usdcToken,
          toToken: stockTokenA,
        },
      });
    });

    expect(store.get(swapQuoteListAtom())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ quoteId: 'early-stock-quote' }),
        expect.objectContaining({ quoteId: 'second-stock-quote' }),
      ]),
    );
    expect(store.get(swapQuoteCurrentEventReceivedCountAtom())).toBe(2);
  });

  it('ignores stale Stock quote event results after the input amount changes', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteEventTotalCountAtom(), {
        eventId: 'stale-event',
        count: 1,
      });
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId: 'stale-stock-result-request',
      });
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );
    const quoteEvent = {
      data: JSON.stringify({
        data: [
          {
            eventId: 'stale-event',
            info: {
              provider: 'stock',
              providerName: 'Stock',
            },
            fromTokenInfo: usdcToken,
            toAmount: '1',
            toTokenInfo: stockTokenA,
            protocol: EProtocolOfExchange.STOCK,
          },
        ],
      }),
    } as ISwapQuoteEvent;
    const quoteParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '2',
      protocol: EProtocolOfExchange.STOCK,
      slippagePercentage: 0.5,
      toNetworkId: stockTokenA.networkId,
      toTokenAddress: stockTokenA.contractAddress,
    };

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: quoteEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'stale-stock-result-request',
        tokenPairs: {
          fromToken: usdcToken,
          toToken: stockTokenA,
        },
      });
    });

    expect(store.get(swapQuoteListAtom())).toEqual([]);
  });

  it('ignores stale Stock quote event errors after the input amount changes', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId: 'stale-stock-error-request',
      });
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );
    const quoteEvent = {
      data: JSON.stringify({
        errorMessage: 'Min amount/request 10 USDC',
        eventId: 'stale-error-event',
      }),
    } as ISwapQuoteEvent;
    const quoteParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '2',
      protocol: EProtocolOfExchange.STOCK,
      slippagePercentage: 0.5,
      toNetworkId: stockTokenA.networkId,
      toTokenAddress: stockTokenA.contractAddress,
    };

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: quoteEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'stale-stock-error-request',
        tokenPairs: {
          fromToken: usdcToken,
          toToken: stockTokenA,
        },
      });
    });

    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
    expect(store.get(swapQuoteEventErrorAtom())).toBeUndefined();
  });

  it('keeps current Stock quote event errors out of generic red swap alerts', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
        isInput: true,
      });
      storeInstance.set(swapQuoteActionLockAtom(), {
        actionLock: true,
        quoteRequestId: 'current-stock-error-request',
      });
    });
    const { result } = renderHook(
      () => {
        const actions = useSwapActions().current;

        return {
          actions,
        };
      },
      {
        wrapper: Wrapper,
      },
    );
    const quoteEvent = {
      data: JSON.stringify({
        errorMessage: 'Market is closed',
        eventId: 'current-market-closed-event',
        isMarketOpen: false,
      }),
    } as ISwapQuoteEvent;
    const quoteParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '21',
      protocol: EProtocolOfExchange.STOCK,
      slippagePercentage: 0.5,
      toNetworkId: stockTokenA.networkId,
      toTokenAddress: stockTokenA.contractAddress,
    };

    await act(async () => {
      result.current.actions.quoteEventHandler({
        event: quoteEvent,
        type: 'message',
        params: quoteParams,
        quoteRequestId: 'current-stock-error-request',
        tokenPairs: {
          fromToken: usdcToken,
          toToken: stockTokenA,
        },
      });
    });

    expect(store.get(swapQuoteEventErrorAtom())).toEqual(
      expect.objectContaining({
        message: 'Market is closed',
        fromToken: usdcToken,
        toToken: stockTokenA,
        fromTokenAmount: '21',
        isStock: true,
        isMarketOpen: false,
        eventId: 'current-market-closed-event',
      }),
    );
    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledWith(
      'current-stock-error-request',
    );
  });

  it('does not emit or check unsupported-account alerts while addresses are resolving', async () => {
    mockCheckAccountNetworkNotSupported.mockResolvedValue(true);
    const resolvingAddressInfo = createExternalAddressInfo({
      address: undefined,
      isAddressInfoReady: false,
    });
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdtToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          resolvingAddressInfo,
          resolvingAddressInfo,
          { allowNoConnectWallet: true },
        );
      });
    });

    expect(mockCheckAccountNetworkNotSupported).not.toHaveBeenCalled();
    expect(store.get(swapAlertsAtom())).toEqual({
      quoteId: '',
      states: [],
    });
  });

  it('keeps the unsupported-account alert after address resolution completes', async () => {
    const unsupportedAddressInfo = createExternalAddressInfo({
      address: undefined,
      isAddressInfoReady: true,
    });
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdtToken);
      storeInstance.set(swapSelectToTokenAtom(), appleStockToken);
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await withMutedConsoleError(async () => {
      await act(async () => {
        await result.current.checkSwapWarning(
          unsupportedAddressInfo,
          unsupportedAddressInfo,
          { allowNoConnectWallet: true },
        );
      });
    });

    expect(store.get(swapAlertsAtom()).states).toHaveLength(1);
  });

  it('does not keep noConnectWallet warning when native wallet readiness is not proven', async () => {
    const { store, Wrapper } = createWrapperWithStore();
    store.set(swapNetworks(), [evmSwapNetwork]);
    store.set(swapAlertsAtom(), {
      states: [{ message: 'keep me' }, { noConnectWallet: true }],
      quoteId: 'old-quote',
    });

    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.checkSwapWarning(fromAddressInfo, fromAddressInfo, {
        allowNoConnectWallet: false,
      });
    });

    expect(store.get(swapAlertsAtom()).states).toEqual([
      { message: 'keep me' },
    ]);
  });

  it('keeps noConnectWallet warning when the caller proves a real no-wallet state', async () => {
    const { store, Wrapper } = createWrapperWithStore();
    store.set(swapNetworks(), [evmSwapNetwork]);

    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.checkSwapWarning(fromAddressInfo, fromAddressInfo, {
        allowNoConnectWallet: true,
      });
    });

    expect(store.get(swapAlertsAtom()).states).toEqual([
      { noConnectWallet: true },
    ]);
  });

  it('shows noConnectWallet when a disconnected web wallet leaves stale wallet info', async () => {
    const { store, Wrapper } = createWrapperWithStore();
    store.set(swapNetworks(), [evmSwapNetwork]);
    const disconnectedAddressInfo: ISwapAddressInfo = {
      address: undefined,
      networkId: 'evm--1',
      accountInfo: {
        ...activeAccountInfo,
        account: undefined,
        wallet: externalWallet,
      },
      activeAccount: {
        ...activeAccountInfo,
        account: undefined,
        wallet: externalWallet,
      },
      isAddressInfoReady: true,
    };

    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.checkSwapWarning(
        disconnectedAddressInfo,
        disconnectedAddressInfo,
        {
          allowNoConnectWallet: true,
        },
      );
    });

    expect(store.get(swapAlertsAtom()).states).toEqual([
      { noConnectWallet: true },
    ]);
  });

  it('updates position balances only for the active owner and keeps its cache coherent', async () => {
    const ownerA = 'account-a__evm--1__usd';
    const ownerB = 'account-b__evm--56__usd';
    const updatedAt = 123;
    const { store, Wrapper } = createWrapperWithStore();
    store.set(swapProPositionsCurrentOwnerKeyAtom(), ownerA);
    store.set(swapProPositionsDataOwnerKeyAtom(), ownerA);
    store.set(swapProSupportNetworksTokenListAtom(), [
      { ...ethToken, balanceParsed: '1' },
    ]);
    store.set(swapProPositionsCacheAtom(), {
      version: SWAP_PRO_POSITIONS_CACHE_VERSION,
      byOwner: {
        [ownerA]: {
          ownerKey: ownerA,
          networkIdsKey: 'evm--1',
          currencyId: 'usd',
          tokens: [{ ...ethToken, balanceParsed: '1' }],
          updatedAt,
        },
      },
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.updateSwapProPositionTokenBalances({
        positionOwnerKey: ownerA,
        tokens: [{ ...ethToken, balanceParsed: '2' }],
      });
    });

    expect(
      store.get(swapProSupportNetworksTokenListAtom())[0]?.balanceParsed,
    ).toBe('2');
    expect(
      store.get(swapProPositionsCacheAtom()).byOwner[ownerA]?.tokens[0]
        ?.balanceParsed,
    ).toBe('2');
    expect(
      store.get(swapProPositionsCacheAtom()).byOwner[ownerA]?.updatedAt,
    ).toBe(updatedAt);

    act(() => {
      store.set(swapProPositionsCurrentOwnerKeyAtom(), ownerB);
      store.set(swapProPositionsDataOwnerKeyAtom(), ownerB);
      store.set(swapProSupportNetworksTokenListAtom(), [bnbToken]);
      result.current.updateSwapProPositionTokenBalances({
        positionOwnerKey: ownerA,
        tokens: [{ ...ethToken, balanceParsed: '3' }],
      });
    });

    expect(store.get(swapProSupportNetworksTokenListAtom())).toEqual([
      bnbToken,
    ]);
    expect(
      store.get(swapProPositionsCacheAtom()).byOwner[ownerA]?.tokens[0]
        ?.balanceParsed,
    ).toBe('2');
  });

  it('orders token balance requests and loading across hook instances in the same Swap store', () => {
    const { store, Wrapper } = createWrapperWithStore();
    const firstInstance = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });
    const secondInstance = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    const firstRequestId =
      firstInstance.result.current.beginSwapProTokenBalanceRequest();
    const secondRequestId =
      secondInstance.result.current.beginSwapProTokenBalanceRequest();

    expect(store.get(swapProTokenBalanceLoadingAtom())).toBe(true);
    expect(
      firstInstance.result.current.isSwapProTokenBalanceRequestLatest(
        firstRequestId,
      ),
    ).toBe(false);
    expect(
      secondInstance.result.current.isSwapProTokenBalanceRequestLatest(
        secondRequestId,
      ),
    ).toBe(true);

    firstInstance.result.current.invalidateSwapProTokenBalanceRequest(
      firstRequestId,
    );
    firstInstance.result.current.finishSwapProTokenBalanceRequest(
      firstRequestId,
    );
    expect(store.get(swapProTokenBalanceLoadingAtom())).toBe(true);
    expect(
      secondInstance.result.current.isSwapProTokenBalanceRequestLatest(
        secondRequestId,
      ),
    ).toBe(true);

    secondInstance.result.current.finishSwapProTokenBalanceRequest(
      secondRequestId,
    );
    expect(store.get(swapProTokenBalanceLoadingAtom())).toBe(false);
    expect(
      secondInstance.result.current.isSwapProTokenBalanceRequestLatest(
        secondRequestId,
      ),
    ).toBe(true);

    secondInstance.result.current.invalidateSwapProTokenBalanceRequest(
      secondRequestId,
    );
    expect(
      secondInstance.result.current.isSwapProTokenBalanceRequestLatest(
        secondRequestId,
      ),
    ).toBe(false);
  });

  it('uses a fresh top-N positions cache only as a seed and still restores the full live list', async () => {
    const ownerKey = 'indexed-account__evm--1__usd';
    const liveTokens = Array.from(
      { length: SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER + 5 },
      (_, index): ISwapToken => ({
        networkId: 'evm--1',
        contractAddress: `0x${index.toString(16).padStart(40, '0')}`,
        symbol: `TOKEN-${index}`,
        decimals: 18,
        balanceParsed: `${index}`,
        fiatValue: `${index}`,
      }),
    );
    mockGetSupportSwapAllAccounts.mockResolvedValue({
      supportAccountsFetchFailed: false,
      swapSupportAccounts: [
        {
          apiAddress: '0xaccount',
          networkId: 'evm--1',
          accountId: 'network-account',
        },
      ],
    });
    mockFetchSwapTokens.mockResolvedValue(liveTokens);
    const { store, Wrapper } = createWrapperWithStore();
    store.set(swapProPositionsCacheAtom(), {
      version: SWAP_PRO_POSITIONS_CACHE_VERSION,
      byOwner: {
        [ownerKey]: {
          ownerKey,
          networkIdsKey: 'evm--1',
          currencyId: 'usd',
          tokens: liveTokens.slice(
            0,
            SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER,
          ),
          updatedAt: Date.now(),
        },
      },
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapProLoadSupportNetworksTokenList(
        [{ networkId: 'evm--1', name: 'Ethereum', symbol: 'ETH' }],
        'indexed-account',
        undefined,
        'usd',
      );
    });

    expect(mockFetchSwapTokens).toHaveBeenCalledTimes(1);
    expect(store.get(swapProSupportNetworksTokenListAtom())).toHaveLength(
      SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER + 5,
    );
    expect(store.get(swapProPositionsDataOwnerKeyAtom())).toBe(ownerKey);
    expect(
      store.get(swapProPositionsCacheAtom()).byOwner[ownerKey].tokens,
    ).toHaveLength(SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER);
  });

  it('does not mark a persisted positions seed as live when the refresh fails', async () => {
    const ownerKey = 'indexed-account__evm--1__usd';
    mockGetSupportSwapAllAccounts.mockResolvedValue({
      supportAccountsFetchFailed: true,
      swapSupportAccounts: [],
    });
    const { store, Wrapper } = createWrapperWithStore();
    store.set(swapProPositionsCacheAtom(), {
      version: SWAP_PRO_POSITIONS_CACHE_VERSION,
      byOwner: {
        [ownerKey]: {
          ownerKey,
          networkIdsKey: 'evm--1',
          currencyId: 'usd',
          tokens: [ethToken],
          updatedAt: Date.now(),
        },
      },
    });
    const { result } = renderHook(() => useSwapActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.swapProLoadSupportNetworksTokenList(
        [{ networkId: 'evm--1', name: 'Ethereum', symbol: 'ETH' }],
        'indexed-account',
        undefined,
        'usd',
      );
    });

    expect(store.get(swapProPositionsCurrentOwnerKeyAtom())).toBe(ownerKey);
    expect(store.get(swapProPositionsDataOwnerKeyAtom())).toBe('');
    expect(store.get(swapProSupportNetworksTokenListAtom())).toEqual([]);
    expect(
      store.get(swapProPositionsCacheAtom()).byOwner[ownerKey].tokens,
    ).toEqual([ethToken]);
  });
});
