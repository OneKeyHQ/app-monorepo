/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import BigNumber from 'bignumber.js';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildMarketReviewTokens,
  useSpeedSwapActions,
} from './useSpeedSwapActions';
import { ESwapDirection } from './useTradeType';

type IFetchSwapTokenDetailsParams = {
  accountId?: string;
  networkId?: string;
  contractAddress?: string;
  accountAddress?: string;
  currency?: string;
};

type IFetchSwapNativeTokenConfigParams = {
  networkId: string;
};

type IUsePaymentTokenPriceResult = {
  price?: BigNumber;
  tokenKey?: string;
  isLoading: boolean;
  refetch: jest.Mock;
};

type IUsePaymentTokenPriceMock = (
  paymentToken?: ISwapTokenBase & { price?: string },
  networkId?: string,
  currencyId?: string,
) => IUsePaymentTokenPriceResult;

const mockFetchSwapTokenDetails: jest.MockedFunction<
  (params: IFetchSwapTokenDetailsParams) => Promise<ISwapToken[]>
> = jest.fn();
const mockFetchSwapNativeTokenConfig: jest.MockedFunction<
  (
    params: IFetchSwapNativeTokenConfigParams,
  ) => Promise<{ networkId: string; reserveGas: string }>
> = jest.fn();
const mockSetInAppNotificationAtom = jest.fn();
const mockNavigationToTxConfirm = jest.fn();
const mockNetAccountRun = jest.fn();
const mockMarketDeriveInfoRun = jest.fn();
const mockUsePaymentTokenPrice: jest.MockedFunction<IUsePaymentTokenPriceMock> =
  jest.fn();

let mockUsePromiseResultCallCount = 0;
let mockPaymentTokenPriceCache: Record<string, BigNumber> = {};
let mockNetAccountPromiseResult: {
  result?: {
    id: string;
    addressDetail: {
      address: string;
      networkId: string;
    };
  };
  run: jest.Mock;
};
let mockMarketDeriveInfoPromiseResult: {
  result?: {
    addressEncoding?: string;
  };
  run: jest.Mock;
};
let mockInAppNotificationAtomState: {
  speedSwapApprovingTransaction?: {
    status?: string;
  };
} = {};
let mockCurrencyInfo = {
  id: 'usd',
  symbol: '$',
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchSwapTokenDetails: (params: IFetchSwapTokenDetailsParams) =>
        mockFetchSwapTokenDetails(params),
      fetchSwapNativeTokenConfig: (params: IFetchSwapNativeTokenConfigParams) =>
        mockFetchSwapNativeTokenConfig(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => {
    const nextResult =
      mockUsePromiseResultCallCount % 2 === 0
        ? mockNetAccountPromiseResult
        : mockMarketDeriveInfoPromiseResult;
    mockUsePromiseResultCallCount += 1;
    return nextResult;
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({
    navigationToTxConfirm: mockNavigationToTxConfirm,
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: {
        id: 'account-1',
      },
      indexedAccount: undefined,
      deriveType: 'default',
    },
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms', () => ({
  useSelectedDeriveTypeAtom: () => [undefined],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useInAppNotificationAtom: () => [
    mockInAppNotificationAtomState,
    mockSetInAppNotificationAtom,
  ],
  useSettingsPersistAtom: () => [
    {
      currencyInfo: mockCurrencyInfo,
      isFirstTimeSwap: false,
    },
  ],
  useCurrencyPersistAtom: () => [
    {
      currencyMap: {},
    },
  ],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    NetworkDeriveTypeChanged: 'NetworkDeriveTypeChanged',
    SwapSpeedApprovingReset: 'SwapSpeedApprovingReset',
    SwapSpeedBalanceUpdate: 'SwapSpeedBalanceUpdate',
    SwapSpeedBuildTxSuccess: 'SwapSpeedBuildTxSuccess',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('./usePaymentTokenPrice', () => ({
  usePaymentTokenPrice: (
    paymentToken?: ISwapTokenBase & { price?: string },
    networkId?: string,
    currencyId?: string,
  ): IUsePaymentTokenPriceResult =>
    mockUsePaymentTokenPrice(paymentToken, networkId, currencyId),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function createTokenDetail(overrides: Partial<ISwapToken> = {}): ISwapToken[] {
  return [
    {
      networkId: 'evm--1',
      contractAddress: '0xtoken',
      symbol: 'TOKEN',
      decimals: 18,
      ...overrides,
    },
  ];
}

const usdcToken: ISwapTokenBase = {
  networkId: 'evm--1',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
  isNative: false,
};

const usdtToken: ISwapTokenBase = {
  networkId: 'evm--1',
  contractAddress: '0xusdt',
  symbol: 'USDT',
  decimals: 6,
  isNative: false,
};

const btcToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xbtc',
  symbol: 'BTC',
  decimals: 8,
  isNative: false,
};

const tonMarketToken: ISwapToken = {
  networkId: 'ton--239',
  contractAddress: '0xton',
  symbol: 'TON',
  decimals: 9,
  isNative: false,
};

const tonUsdtToken: ISwapTokenBase = {
  networkId: 'ton--239',
  contractAddress: '0x11112222',
  symbol: 'USDT',
  decimals: 6,
  isNative: false,
};

const solToken: ISwapTokenBase = {
  networkId: 'sol--101',
  contractAddress: '0xsol',
  symbol: 'SOL',
  decimals: 9,
  isNative: false,
};

function getTokenKey(
  token?: ISwapTokenBase,
  networkId?: string,
  currencyId = 'usd',
) {
  return `${networkId ?? token?.networkId ?? ''}:${
    token?.contractAddress ?? ''
  }:${currencyId}`;
}

function createHookProps({
  marketToken = btcToken,
  tradeToken = usdcToken,
}: {
  marketToken?: ISwapToken;
  tradeToken?: ISwapTokenBase;
} = {}) {
  return {
    marketToken: {
      ...marketToken,
      currency: marketToken.currency ?? 'usd',
    },
    tradeToken: {
      ...tradeToken,
      currency: tradeToken.currency ?? 'usd',
    },
    tradeType: ESwapDirection.BUY,
    fromTokenAmount: '0',
    provider: 'onekey',
    spenderAddress: '0xspender',
    slippage: 0.5,
    antiMEV: false,
  };
}

describe('useSpeedSwapActions', () => {
  beforeEach(() => {
    mockFetchSwapTokenDetails.mockReset();
    mockFetchSwapNativeTokenConfig.mockReset();
    mockSetInAppNotificationAtom.mockReset();
    mockNavigationToTxConfirm.mockReset();
    mockNetAccountRun.mockReset();
    mockMarketDeriveInfoRun.mockReset();
    mockUsePaymentTokenPrice.mockReset();
    mockUsePromiseResultCallCount = 0;
    mockPaymentTokenPriceCache = {};
    mockInAppNotificationAtomState = {};
    mockUsePaymentTokenPrice.mockImplementation(
      (
        paymentToken?: ISwapTokenBase & { price?: string },
        networkId?: string,
        currencyId?: string,
      ) => {
        const priceValue = paymentToken?.price;
        let price: BigNumber | undefined;
        if (priceValue) {
          mockPaymentTokenPriceCache[priceValue] =
            mockPaymentTokenPriceCache[priceValue] ?? new BigNumber(priceValue);
          if (mockPaymentTokenPriceCache[priceValue].gt(0)) {
            price = mockPaymentTokenPriceCache[priceValue];
          }
        }
        return {
          price,
          tokenKey: getTokenKey(paymentToken, networkId, currencyId),
          isLoading: false,
          refetch: jest.fn(),
        };
      },
    );
    mockCurrencyInfo = {
      id: 'usd',
      symbol: '$',
    };
    mockFetchSwapNativeTokenConfig.mockResolvedValue({
      networkId: 'evm--1',
      reserveGas: '0.01',
    });
    mockNetAccountPromiseResult = {
      result: {
        id: 'net-account-1',
        addressDetail: {
          address: '0xuser',
          networkId: 'evm--1',
        },
      },
      run: mockNetAccountRun,
    };
    mockMarketDeriveInfoPromiseResult = {
      result: undefined,
      run: mockMarketDeriveInfoRun,
    };
  });

  it('keeps the latest same-network balance when stablecoin balance requests resolve out of order', async () => {
    const oldBalanceRequest = createDeferred<ISwapToken[]>();
    const newBalanceRequest = createDeferred<ISwapToken[]>();

    mockFetchSwapTokenDetails.mockImplementation(
      ({ accountId, contractAddress }: IFetchSwapTokenDetailsParams) => {
        if (!accountId) {
          return Promise.resolve([]);
        }
        if (contractAddress === usdcToken.contractAddress) {
          return oldBalanceRequest.promise;
        }
        if (contractAddress === usdtToken.contractAddress) {
          return newBalanceRequest.promise;
        }
        return Promise.resolve([]);
      },
    );

    const { result, rerender } = renderHook(
      ({ tradeToken }: { tradeToken: ISwapTokenBase }) =>
        useSpeedSwapActions(
          createHookProps({
            marketToken: {
              ...btcToken,
              price: '100000',
            },
            tradeToken: {
              ...tradeToken,
              price: '1',
            },
          }),
        ),
      {
        initialProps: {
          tradeToken: usdcToken,
        },
      },
    );

    await waitFor(() => {
      expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(1);
    });

    rerender({
      tradeToken: usdtToken,
    });

    await waitFor(() => {
      expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(2);
      expect(result.current.balanceToken.symbol).toBe('USDT');
    });

    await act(async () => {
      newBalanceRequest.resolve(
        createTokenDetail({
          networkId: usdtToken.networkId,
          contractAddress: usdtToken.contractAddress,
          symbol: usdtToken.symbol,
          decimals: usdtToken.decimals,
          balanceParsed: '250',
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.balance?.toFixed()).toBe('250');
      expect(result.current.fetchBalanceLoading).toBe(false);
    });

    await act(async () => {
      oldBalanceRequest.resolve(
        createTokenDetail({
          networkId: usdcToken.networkId,
          contractAddress: usdcToken.contractAddress,
          symbol: usdcToken.symbol,
          decimals: usdcToken.decimals,
          balanceParsed: '100',
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.balanceToken.symbol).toBe('USDT');
      expect(result.current.balance?.toFixed()).toBe('250');
      expect(result.current.fetchBalanceLoading).toBe(false);
    });
  });

  it('waits for the matching network account before refreshing the current token balance', async () => {
    mockFetchSwapTokenDetails.mockResolvedValue(
      createTokenDetail({
        networkId: usdcToken.networkId,
        contractAddress: usdcToken.contractAddress,
        symbol: usdcToken.symbol,
        decimals: usdcToken.decimals,
        balanceParsed: '100',
      }),
    );
    const getBalanceFetchCalls = () =>
      mockFetchSwapTokenDetails.mock.calls.filter(
        ([params]) => params.accountId,
      );

    const { result, rerender } = renderHook(
      ({
        marketToken,
        tradeToken,
      }: {
        marketToken: ISwapToken;
        tradeToken: ISwapTokenBase;
      }) =>
        useSpeedSwapActions(
          createHookProps({
            marketToken,
            tradeToken,
          }),
        ),
      {
        initialProps: {
          marketToken: btcToken,
          tradeToken: usdcToken,
        },
      },
    );

    await waitFor(() => {
      expect(getBalanceFetchCalls()).toHaveLength(1);
      expect(result.current.balance?.toFixed()).toBe('100');
    });

    rerender({
      marketToken: tonMarketToken,
      tradeToken: tonUsdtToken,
    });

    await waitFor(() => {
      expect(getBalanceFetchCalls()).toHaveLength(1);
      expect(result.current.balanceToken.networkId).toBe(
        tonUsdtToken.networkId,
      );
      expect(result.current.balance?.toFixed()).toBe('0');
    });

    mockNetAccountPromiseResult = {
      result: {
        id: 'net-account-ton',
        addressDetail: {
          address: 'ton-user',
          networkId: tonUsdtToken.networkId,
        },
      },
      run: mockNetAccountRun,
    };

    rerender({
      marketToken: tonMarketToken,
      tradeToken: tonUsdtToken,
    });

    await waitFor(() => {
      expect(getBalanceFetchCalls()).toHaveLength(2);
      expect(getBalanceFetchCalls().at(-1)?.[0]).toEqual(
        expect.objectContaining({
          accountId: 'net-account-ton',
          accountAddress: 'ton-user',
          networkId: tonUsdtToken.networkId,
          contractAddress: tonUsdtToken.contractAddress,
        }),
      );
    });
  });

  it('ignores unrelated balance update events while the current balance request is in flight', async () => {
    const currentBalanceRequest = createDeferred<ISwapToken[]>();

    mockFetchSwapTokenDetails.mockImplementation(
      ({ accountId }: IFetchSwapTokenDetailsParams) => {
        if (!accountId) {
          return Promise.resolve([]);
        }
        return currentBalanceRequest.promise;
      },
    );

    const { result } = renderHook(() =>
      useSpeedSwapActions(
        createHookProps({
          marketToken: btcToken,
          tradeToken: usdcToken,
        }),
      ),
    );

    await waitFor(() => {
      expect(mockFetchSwapTokenDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'net-account-1',
          networkId: usdcToken.networkId,
          contractAddress: usdcToken.contractAddress,
        }),
      );
    });

    const balanceUpdateListener = (appEventBus.on as jest.Mock).mock.calls.find(
      ([eventName]) => eventName === EAppEventBusNames.SwapSpeedBalanceUpdate,
    )?.[1] as
      | ((params: {
          orderFromToken: ISwapTokenBase;
          orderToToken: ISwapTokenBase;
        }) => void)
      | undefined;

    expect(balanceUpdateListener).toBeDefined();

    act(() => {
      balanceUpdateListener?.({
        orderFromToken: solToken,
        orderToToken: tonUsdtToken,
      });
    });

    await act(async () => {
      currentBalanceRequest.resolve(
        createTokenDetail({
          networkId: usdcToken.networkId,
          contractAddress: usdcToken.contractAddress,
          symbol: usdcToken.symbol,
          decimals: usdcToken.decimals,
          balanceParsed: '100',
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.balance?.toFixed()).toBe('100');
      expect(result.current.fetchBalanceLoading).toBe(false);
    });
  });

  it('does not refetch the current balance when only the market token price changes', async () => {
    mockFetchSwapTokenDetails.mockResolvedValue(
      createTokenDetail({
        networkId: btcToken.networkId,
        contractAddress: btcToken.contractAddress,
        symbol: btcToken.symbol,
        decimals: btcToken.decimals,
        balanceParsed: '3',
      }),
    );

    const getBalanceFetchCalls = () =>
      mockFetchSwapTokenDetails.mock.calls.filter(
        ([params]) => params.accountId,
      );

    const { rerender } = renderHook(
      ({ marketPrice }: { marketPrice: string }) =>
        useSpeedSwapActions({
          ...createHookProps({
            marketToken: {
              ...btcToken,
              price: marketPrice,
            },
            tradeToken: {
              ...usdcToken,
              price: '1',
            },
          }),
          tradeType: ESwapDirection.SELL,
        }),
      {
        initialProps: {
          marketPrice: '100000',
        },
      },
    );

    await waitFor(() => {
      expect(getBalanceFetchCalls()).toHaveLength(1);
      expect(getBalanceFetchCalls()[0][0]).toEqual(
        expect.objectContaining({
          accountId: 'net-account-1',
          networkId: btcToken.networkId,
          contractAddress: btcToken.contractAddress,
        }),
      );
    });

    rerender({
      marketPrice: '120000',
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(getBalanceFetchCalls()).toHaveLength(1);
  });

  it('falls back to the current token price sources when the live price still belongs to the previous token', async () => {
    mockNetAccountPromiseResult = {
      result: undefined,
      run: mockNetAccountRun,
    };
    mockUsePaymentTokenPrice.mockReturnValue({
      price: new BigNumber(1),
      tokenKey: getTokenKey(usdcToken),
      isLoading: false,
      refetch: jest.fn(),
    });
    mockFetchSwapTokenDetails.mockImplementation(
      ({
        accountId,
        networkId,
        contractAddress,
      }: IFetchSwapTokenDetailsParams) => {
        if (accountId) {
          return Promise.resolve([]);
        }

        const requestKey = `${networkId ?? ''}:${contractAddress ?? ''}`;
        switch (requestKey) {
          case `${usdtToken.networkId}:${usdtToken.contractAddress}`:
            return Promise.resolve(
              createTokenDetail({
                networkId: usdtToken.networkId,
                contractAddress: usdtToken.contractAddress,
                symbol: usdtToken.symbol,
                decimals: usdtToken.decimals,
                price: '1',
              }),
            );
          case `${tonMarketToken.networkId}:${tonMarketToken.contractAddress}`:
            return Promise.resolve(
              createTokenDetail({
                networkId: tonMarketToken.networkId,
                contractAddress: tonMarketToken.contractAddress,
                symbol: tonMarketToken.symbol,
                decimals: tonMarketToken.decimals,
                price: '5',
              }),
            );
          default:
            return Promise.resolve([]);
        }
      },
    );

    const { result } = renderHook(() =>
      useSpeedSwapActions(
        createHookProps({
          marketToken: {
            ...tonMarketToken,
            price: '5',
          },
          tradeToken: {
            ...usdtToken,
            price: '0',
          },
        }),
      ),
    );

    await waitFor(() => {
      expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(2);
      expect(result.current.priceRate).toEqual(
        expect.objectContaining({
          fromTokenSymbol: 'USDT',
          toTokenSymbol: 'TON',
          loading: false,
        }),
      );
      expect(result.current.priceRate?.rate).toBeCloseTo(0.2);
    });
  });

  it('uses refreshed live payment token prices without requiring token reselection', async () => {
    mockNetAccountPromiseResult = {
      result: undefined,
      run: mockNetAccountRun,
    };
    mockUsePaymentTokenPrice.mockReturnValue({
      price: new BigNumber(2),
      tokenKey: getTokenKey(usdcToken),
      isLoading: false,
      refetch: jest.fn(),
    });

    const { result, rerender } = renderHook(
      ({ revision }: { revision: number }) => {
        void revision;
        return useSpeedSwapActions(
          createHookProps({
            marketToken: {
              ...tonMarketToken,
              price: '5',
            },
            tradeToken: {
              ...usdcToken,
              price: '1',
            },
          }),
        );
      },
      {
        initialProps: {
          revision: 0,
        },
      },
    );

    await waitFor(() => {
      expect(result.current.priceRate).toEqual(
        expect.objectContaining({
          fromTokenSymbol: 'USDC',
          toTokenSymbol: 'TON',
          loading: false,
        }),
      );
      expect(result.current.priceRate?.rate).toBeCloseTo(0.4);
    });

    expect(mockFetchSwapTokenDetails).not.toHaveBeenCalled();

    mockUsePaymentTokenPrice.mockReturnValue({
      price: new BigNumber(4),
      tokenKey: getTokenKey(usdcToken),
      isLoading: false,
      refetch: jest.fn(),
    });

    rerender({
      revision: 1,
    });

    await waitFor(() => {
      expect(result.current.priceRate?.rate).toBeCloseTo(0.8);
    });

    expect(mockFetchSwapTokenDetails).not.toHaveBeenCalled();
  });

  it('ignores live payment token prices from a stale currency scope', async () => {
    mockCurrencyInfo = {
      id: 'cny',
      symbol: 'CNY',
    };
    mockNetAccountPromiseResult = {
      result: undefined,
      run: mockNetAccountRun,
    };
    mockUsePaymentTokenPrice.mockReturnValue({
      price: new BigNumber(2),
      tokenKey: getTokenKey(usdcToken, undefined, 'usd'),
      isLoading: false,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() =>
      useSpeedSwapActions(
        createHookProps({
          marketToken: {
            ...tonMarketToken,
            price: '5',
            currency: 'cny',
          },
          tradeToken: {
            ...usdcToken,
            price: '10',
            currency: 'cny',
          },
        }),
      ),
    );

    await waitFor(() => {
      expect(mockUsePaymentTokenPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          contractAddress: usdcToken.contractAddress,
        }),
        usdcToken.networkId,
        'cny',
      );
      expect(result.current.priceRate?.rate).toBeCloseTo(2);
    });

    expect(mockFetchSwapTokenDetails).not.toHaveBeenCalled();
  });

  it('falls back to same-currency fetched prices when inline price currencies differ', async () => {
    mockCurrencyInfo = {
      id: 'cny',
      symbol: 'CNY',
    };
    mockNetAccountPromiseResult = {
      result: undefined,
      run: mockNetAccountRun,
    };
    mockUsePaymentTokenPrice.mockReturnValue({
      price: new BigNumber(10),
      tokenKey: getTokenKey(usdcToken, undefined, 'cny'),
      isLoading: false,
      refetch: jest.fn(),
    });
    mockFetchSwapTokenDetails.mockImplementation(
      ({
        accountId,
        networkId,
        contractAddress,
      }: IFetchSwapTokenDetailsParams) => {
        if (accountId) {
          return Promise.resolve([]);
        }

        const requestKey = `${networkId ?? ''}:${contractAddress ?? ''}`;
        switch (requestKey) {
          case `${usdcToken.networkId}:${usdcToken.contractAddress}`:
            return Promise.resolve(
              createTokenDetail({
                networkId: usdcToken.networkId,
                contractAddress: usdcToken.contractAddress,
                symbol: usdcToken.symbol,
                decimals: usdcToken.decimals,
                price: '2',
              }),
            );
          case `${tonMarketToken.networkId}:${tonMarketToken.contractAddress}`:
            return Promise.resolve(
              createTokenDetail({
                networkId: tonMarketToken.networkId,
                contractAddress: tonMarketToken.contractAddress,
                symbol: tonMarketToken.symbol,
                decimals: tonMarketToken.decimals,
                price: '4',
              }),
            );
          default:
            return Promise.resolve([]);
        }
      },
    );

    const { result } = renderHook(() =>
      useSpeedSwapActions(
        createHookProps({
          marketToken: {
            ...tonMarketToken,
            price: '5',
            currency: 'usd',
          },
          tradeToken: {
            ...usdcToken,
            price: '10',
            currency: 'cny',
          },
        }),
      ),
    );

    await waitFor(() => {
      expect(result.current.priceRate?.rate).toBeCloseTo(0.5);
    });

    expect(mockFetchSwapTokenDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: usdcToken.networkId,
        contractAddress: usdcToken.contractAddress,
        currency: 'usd',
      }),
    );
    expect(mockFetchSwapTokenDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: tonMarketToken.networkId,
        contractAddress: tonMarketToken.contractAddress,
        currency: 'usd',
      }),
    );
  });
});

describe('buildMarketReviewTokens', () => {
  it('applies the live payment token price to the buy review from token', () => {
    const reviewTokens = buildMarketReviewTokens({
      tradeType: ESwapDirection.BUY,
      fromToken: {
        ...usdcToken,
        price: '0',
      } as ISwapToken,
      toToken: {
        ...tonMarketToken,
        price: '5',
      },
      tradeTokenPrice: new BigNumber(2),
    });

    expect(reviewTokens.fromToken.price).toBe('2');
    expect(reviewTokens.toToken.price).toBe('5');
  });

  it('applies the live payment token price to the sell review to token', () => {
    const reviewTokens = buildMarketReviewTokens({
      tradeType: ESwapDirection.SELL,
      fromToken: {
        ...tonMarketToken,
        price: '5',
      },
      toToken: {
        ...usdcToken,
        price: '0',
      } as ISwapToken,
      tradeTokenPrice: new BigNumber(2),
    });

    expect(reviewTokens.fromToken.price).toBe('5');
    expect(reviewTokens.toToken.price).toBe('2');
  });
});
