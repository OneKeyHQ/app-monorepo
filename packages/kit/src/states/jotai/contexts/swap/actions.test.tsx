/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { useSwapAddressInfo } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapAccount';
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
  swapAlertsAtom,
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapLastNonLimitSelectedTokensAtom,
  swapNetworks,
  swapQuoteActionLockAtom,
  swapQuoteCurrentEventProviderKeysAtom,
  swapQuoteCurrentEventReceivedCountAtom,
  swapQuoteCurrentSelectAtom,
  swapQuoteEventCompletedAtom,
  swapQuoteEventErrorAtom,
  swapQuoteEventTotalCountAtom,
  swapQuoteListAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedTokensColdStartContextAtom,
  swapStockExecutionTokenSyncIdAtom,
  swapStockExecutionTokensAtom,
  swapStockSelectedTokenAtom,
  swapToTokenAmountAtom,
  swapTypeSwitchAtom,
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
const mockCancelFetchQuoteEvents: jest.MockedFunction<() => Promise<void>> =
  jest.fn();
const mockSetSwapNetworksSortRawData: jest.MockedFunction<
  (params: { data: unknown[] }) => Promise<void>
> = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchSwapTokenDetails: (params: IFetchSwapTokenDetailsParams) =>
        mockFetchSwapTokenDetails(params),
      fetchQuotesEvents: (params: unknown) => mockFetchQuotesEvents(params),
      closeApproving: () => mockCloseApproving(),
      cancelFetchQuoteEvents: () => mockCancelFetchQuoteEvents(),
    },
    simpleDb: {
      swapNetworksSort: {
        setRawData: (params: { data: unknown[] }) =>
          mockSetSwapNetworksSortRawData(params),
      },
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
    mockFetchQuotesEvents.mockResolvedValue(undefined);
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
        const [fromToken] = useSwapSelectFromTokenAtom();
        const [balance] = useSwapSelectedFromTokenBalanceAtom();

        return {
          actions,
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

  it('keeps previous Stock provider quotes when amount formatting is normalized', async () => {
    const oldQuote = {
      quoteId: 'old-stock-provider-quote',
      eventId: 'previous-event',
      fromAmount: '1000',
      toAmount: '10',
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

    await act(async () => {
      result.current.quoteEventHandler({
        event: quoteEvent,
        type: 'message',
        params: {
          fromNetworkId: usdcToken.networkId,
          fromTokenAddress: usdcToken.contractAddress,
          fromTokenAmount: '1000.0',
          protocol: EProtocolOfExchange.STOCK,
          slippagePercentage: 0.5,
          toNetworkId: appleStockToken.networkId,
          toTokenAddress: appleStockToken.contractAddress,
        },
        tokenPairs: {
          fromToken: usdcToken,
          toToken: appleStockToken,
        },
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

  it('restores the previous Swap pair after visiting Stock', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      storeInstance.set(swapSelectFromTokenAtom(), bnbToken);
      storeInstance.set(swapSelectToTokenAtom(), usdtToken);
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

    store.set(swapSelectFromTokenAtom(), usdcToken);
    store.set(swapSelectToTokenAtom(), appleStockToken);

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
        toToken: stockTokenA,
        toTokenAmount: '',
        type: ESwapTabSwitchType.STOCK,
      }),
    );

    await waitFor(() =>
      expect(mockFetchQuotesEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: evmAccount.id,
          autoSlippage: true,
          fromToken: usdcToken,
          fromTokenAmount: '1',
          incognito: false,
          protocol: ESwapTabSwitchType.STOCK,
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

  it('accepts Stock quote event results before the total count event arrives', async () => {
    const { store, Wrapper } = createWrapperWithStore((storeInstance) => {
      storeInstance.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
      storeInstance.set(swapSelectFromTokenAtom(), usdcToken);
      storeInstance.set(swapSelectToTokenAtom(), stockTokenA);
      storeInstance.set(swapFromTokenAmountAtom(), {
        value: '21',
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
});
