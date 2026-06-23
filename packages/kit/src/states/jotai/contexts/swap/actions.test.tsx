/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { useSwapAddressInfo } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapAccount';
import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IFetchQuotesParams,
  ISwapQuoteEvent,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapActions } from './actions';
import {
  ProviderJotaiContextSwap,
  swapFromTokenAmountAtom,
  swapNetworks,
  swapQuoteActionLockAtom,
  swapQuoteEventTotalCountAtom,
  swapQuoteListAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapStockExecutionTokenSyncIdAtom,
  swapStockExecutionTokensAtom,
  swapTypeSwitchAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
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
};
const appleStockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPL',
  decimals: 18,
  isNative: false,
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
    },
    {
      networkId: 'evm--56',
      name: 'BNB Smart Chain',
      symbol: 'BNB',
      logoURI: '',
      shortcode: 'bsc',
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

        return {
          actions,
          fromToken,
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
            protocol: ESwapTabSwitchType.STOCK,
          },
        ],
      }),
    } as ISwapQuoteEvent;
    const quoteParams: IFetchQuotesParams = {
      fromNetworkId: usdcToken.networkId,
      fromTokenAddress: usdcToken.contractAddress,
      fromTokenAmount: '1',
      protocol: ESwapTabSwitchType.STOCK,
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
});
