import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildDefaultMarketSpeedCheckState,
  buildMarketReviewShouldFallback,
  mergeMarketBuildResultWithQuote,
  pickMarketQuoteResultByProvider,
  shouldFetchMarketQuoteFallbackData,
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
});
