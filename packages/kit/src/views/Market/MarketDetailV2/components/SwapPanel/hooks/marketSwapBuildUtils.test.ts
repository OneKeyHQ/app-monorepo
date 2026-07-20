import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
} from '@onekeyhq/shared/types/swap/types';

import {
  type IMarketWrappedQuoteRequest,
  buildDefaultMarketSpeedCheckState,
  buildMarketReviewShouldFallback,
  mergeMarketBuildResultWithQuote,
  pickMarketQuoteResultByProvider,
  shouldFetchMarketQuoteFallbackData,
  waitForMarketWrappedQuote,
} from './marketSwapBuildUtils';

function createQuoteResult(
  overrides: Partial<IFetchQuoteResult> = {},
): IFetchQuoteResult {
  return {
    info: {
      provider: 'provider-a',
      providerName: 'Provider A',
    },
    fromTokenInfo: {
      networkId: 'evm--1',
      contractAddress: '0xfrom',
      symbol: 'ETH',
      decimals: 18,
      isNative: true,
    },
    toTokenInfo: {
      networkId: 'evm--1',
      contractAddress: '0xto',
      symbol: 'USDC',
      decimals: 6,
      isNative: false,
    },
    fromAmount: '1',
    toAmount: '1000',
    ...overrides,
  };
}

function createBuildRes(
  overrides: Partial<IFetchBuildTxResponse> = {},
): IFetchBuildTxResponse {
  return {
    result: {
      info: {
        provider: 'provider-a',
        providerName: 'Provider A',
      },
      fromTokenInfo: createQuoteResult().fromTokenInfo,
      toTokenInfo: createQuoteResult().toTokenInfo,
      fromAmount: '1',
      toAmount: '1000',
    },
    ...overrides,
  } as IFetchBuildTxResponse;
}

describe('marketSwapBuildUtils', () => {
  const wrappedQuoteRequest: IMarketWrappedQuoteRequest = {
    accountId: 'account-1',
    fromToken: {
      networkId: 'evm--4663',
      contractAddress: '',
      symbol: 'ETH',
      decimals: 18,
      isNative: true,
    },
    toToken: {
      networkId: 'evm--4663',
      contractAddress: '0x0bd7d308f8e1639fab988df18a8011f41eacad73',
      symbol: 'WETH',
      decimals: 18,
      isNative: false,
    },
    quoteEventSessionId: 'market-session-1',
    fromTokenAmount: '1',
    slippagePercentage: 0.5,
  };

  function createQuoteEvent({
    data,
    fromTokenAmount = wrappedQuoteRequest.fromTokenAmount,
    quoteEventSessionId = wrappedQuoteRequest.quoteEventSessionId,
  }: {
    data: unknown;
    fromTokenAmount?: string;
    quoteEventSessionId?: string;
  }) {
    return {
      type: 'message' as const,
      event: {
        type: 'message' as const,
        data: JSON.stringify(data),
      },
      params: {
        fromNetworkId: wrappedQuoteRequest.fromToken.networkId,
        toNetworkId: wrappedQuoteRequest.toToken.networkId,
        fromTokenAddress: wrappedQuoteRequest.fromToken.contractAddress,
        toTokenAddress: wrappedQuoteRequest.toToken.contractAddress,
        fromTokenAmount,
        slippagePercentage: wrappedQuoteRequest.slippagePercentage,
      },
      quoteEventSessionId,
      tokenPairs: {
        fromToken: wrappedQuoteRequest.fromToken,
        toToken: wrappedQuoteRequest.toToken,
      },
      accountId: wrappedQuoteRequest.accountId,
    } as never;
  }

  it('aligns Market fallback logic with Swap fallback networks', () => {
    expect(
      buildMarketReviewShouldFallback({
        networkId: 'tron--0x2b6653dc',
      }),
    ).toBe(true);
    expect(
      buildMarketReviewShouldFallback({
        networkId: 'evm--1',
      }),
    ).toBe(false);
  });

  it('falls back when custom RPC is unavailable', () => {
    expect(
      buildMarketReviewShouldFallback({
        networkId: 'evm--1',
        isCustomRpcUnavailable: true,
      }),
    ).toBe(true);
  });

  it('builds a full default speed-check reset state', () => {
    expect(buildDefaultMarketSpeedCheckState()).toEqual({
      speedCheckError: '',
      checkSpenderAddress: '',
      isStock: false,
      shouldApprove: false,
      shouldResetApprove: false,
    });
  });

  it('detects when Market build data needs quote fallbacks', () => {
    expect(
      shouldFetchMarketQuoteFallbackData(
        createBuildRes({
          result: {
            ...createBuildRes().result,
            gasLimit: 0,
          },
        }),
      ),
    ).toBe(true);
    expect(
      shouldFetchMarketQuoteFallbackData(
        createBuildRes({
          result: {
            ...createBuildRes().result,
            gasLimit: 21_000,
            routesData: [{ subRoutes: [] }] as never,
          },
        }),
      ),
    ).toBe(false);
  });

  it('picks the matching quote by provider and provider name', () => {
    const matchedQuote = createQuoteResult({
      info: {
        provider: 'provider-b',
        providerName: 'Provider B',
      },
    });
    const fallbackQuote = createQuoteResult();

    expect(
      pickMarketQuoteResultByProvider({
        quotes: [fallbackQuote, matchedQuote],
        provider: 'provider-b',
        providerName: 'Provider B',
      }),
    ).toBe(matchedQuote);
  });

  it('hydrates missing gasLimit and routesData from the selected quote', () => {
    const merged = mergeMarketBuildResultWithQuote({
      buildRes: createBuildRes({
        result: {
          ...createBuildRes().result,
          gasLimit: 0,
        },
      }),
      quoteResult: createQuoteResult({
        gasLimit: 45_678,
        minToAmount: '950',
        routesData: [{ subRoutes: [[{}]] }] as never,
      }),
    });

    expect(merged.result.gasLimit).toBe(45_678);
    expect(merged.result.minToAmount).toBe('950');
    expect(merged.result.routesData).toHaveLength(1);
  });

  it('does not overwrite build result fields that are already present', () => {
    const merged = mergeMarketBuildResultWithQuote({
      buildRes: createBuildRes({
        result: {
          ...createBuildRes().result,
          gasLimit: 12_345,
          routesData: [{ subRoutes: [[{ id: 'build' }]] }] as never,
        },
      }),
      quoteResult: createQuoteResult({
        gasLimit: 45_678,
        routesData: [{ subRoutes: [[{ id: 'quote' }]] }] as never,
      }),
    });

    expect(merged.result.gasLimit).toBe(12_345);
    expect(merged.result.routesData?.[0]?.subRoutes?.[0]?.[0]).toEqual({
      id: 'build',
    });
  });

  it('resolves the wrapped quote from the matching events request', async () => {
    let listener: ((event: never) => void) | undefined;
    const unsubscribe = jest.fn();
    const cancel = jest.fn(async () => undefined);
    const quoteResult = createQuoteResult({
      quoteId: 'quote-1',
      eventId: 'event-1',
      isWrapped: true,
      info: {
        provider: 'wrapped',
        providerName: 'Wrap Contract',
      },
      fromTokenInfo: wrappedQuoteRequest.fromToken,
      toTokenInfo: wrappedQuoteRequest.toToken,
      fromAmount: '1',
      toAmount: '1',
    });

    const quotePromise = waitForMarketWrappedQuote({
      request: wrappedQuoteRequest,
      subscribe: (nextListener) => {
        listener = nextListener as (event: never) => void;
        return unsubscribe;
      },
      start: async () => {
        listener?.(
          createQuoteEvent({
            data: {
              totalQuoteCount: 1,
              eventId: 'event-1',
            },
          }),
        );
        listener?.(
          createQuoteEvent({
            data: {
              data: [quoteResult],
            },
          }),
        );
      },
      cancel,
    });

    await expect(quotePromise).resolves.toStrictEqual(quoteResult);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('ignores stale sessions, amounts, and event ids before accepting the active quote', async () => {
    let listener: ((event: never) => void) | undefined;
    const activeQuote = createQuoteResult({
      quoteId: 'quote-active',
      eventId: 'event-active',
      isWrapped: true,
      fromTokenInfo: wrappedQuoteRequest.fromToken,
      toTokenInfo: wrappedQuoteRequest.toToken,
      fromAmount: '1',
      toAmount: '1',
    });

    const quotePromise = waitForMarketWrappedQuote({
      request: wrappedQuoteRequest,
      subscribe: (nextListener) => {
        listener = nextListener as (event: never) => void;
        return jest.fn();
      },
      start: async () => {
        listener?.(
          createQuoteEvent({
            quoteEventSessionId: 'market-session-stale',
            data: {
              eventId: 'event-stale-session',
              errorMessage: 'stale session error',
            },
          }),
        );
        listener?.(
          createQuoteEvent({
            fromTokenAmount: '2',
            data: {
              totalQuoteCount: 1,
              eventId: 'event-stale-amount',
            },
          }),
        );
        listener?.(
          createQuoteEvent({
            data: {
              totalQuoteCount: 1,
              eventId: 'event-active',
            },
          }),
        );
        listener?.(
          createQuoteEvent({
            data: {
              totalQuoteCount: 1,
              eventId: 'event-stale',
            },
          }),
        );
        listener?.(
          createQuoteEvent({
            data: {
              eventId: 'event-stale',
              errorMessage: 'stale event error',
            },
          }),
        );
        listener?.(
          createQuoteEvent({
            data: {
              data: [
                {
                  ...activeQuote,
                  eventId: 'event-stale',
                },
              ],
            },
          }),
        );
        listener?.(
          createQuoteEvent({
            data: {
              data: [activeQuote],
            },
          }),
        );
      },
      cancel: async () => undefined,
    });

    await expect(quotePromise).resolves.toStrictEqual(activeQuote);
  });

  it('surfaces a matching server quote error', async () => {
    let listener: ((event: never) => void) | undefined;

    const quotePromise = waitForMarketWrappedQuote({
      request: wrappedQuoteRequest,
      subscribe: (nextListener) => {
        listener = nextListener as (event: never) => void;
        return jest.fn();
      },
      start: async () => {
        listener?.(
          createQuoteEvent({
            data: {
              eventId: 'event-error',
              errorMessage: 'wrapped quote unavailable',
            },
          }),
        );
      },
      cancel: async () => undefined,
    });

    await expect(quotePromise).rejects.toThrow('wrapped quote unavailable');
  });
});
