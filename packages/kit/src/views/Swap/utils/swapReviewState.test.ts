import {
  ESwapStepStatus,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchBuildTxResult,
  IFetchQuoteResult,
  ISwapStep,
} from '@onekeyhq/shared/types/swap/types';

import {
  NATIVE_BTC_MIN_SLIPPAGE_PERCENTAGE,
  buildCustomSlippageQuoteResultCtx,
  buildRebuiltSwapReviewQuoteResult,
  calculateMinToAmountBySlippage,
  hasInFlightSwapReviewSteps,
  invalidateSwapReviewForSlippageChange,
  resolveSwapReviewNeedFetchGasAfterRebuild,
  shouldCloseSwapReviewOnFocusLoss,
  shouldShowNativeBtcLowSlippageWarning,
  shouldShowSwapReviewToAmountSkeleton,
} from './swapReviewState';

describe('shouldShowNativeBtcLowSlippageWarning', () => {
  const nativeBtc = {
    networkId: 'btc--0',
    isNative: true,
  };
  const wrappedBtc = {
    networkId: 'evm--1',
    isNative: false,
  };

  it.each([
    ['pay token', nativeBtc, wrappedBtc],
    ['receive token', wrappedBtc, nativeBtc],
  ])('shows for a native Bitcoin %s below 1%%', (_, fromToken, toToken) => {
    expect(
      shouldShowNativeBtcLowSlippageWarning({
        fromToken,
        toToken,
        slippage: 0.99,
        swapType: ESwapTabSwitchType.BRIDGE,
      }),
    ).toBe(true);
  });

  it.each([NATIVE_BTC_MIN_SLIPPAGE_PERCENTAGE, 1.5])(
    'hides at or above the 1%% boundary (%s)',
    (slippage) => {
      expect(
        shouldShowNativeBtcLowSlippageWarning({
          fromToken: nativeBtc,
          toToken: wrappedBtc,
          slippage,
          swapType: ESwapTabSwitchType.SWAP,
        }),
      ).toBe(false);
    },
  );

  it('does not treat wrapped BTC as native Bitcoin', () => {
    expect(
      shouldShowNativeBtcLowSlippageWarning({
        fromToken: wrappedBtc,
        toToken: wrappedBtc,
        slippage: 0.5,
        swapType: ESwapTabSwitchType.SWAP,
      }),
    ).toBe(false);
  });

  it('excludes Swap Pro market reviews', () => {
    expect(
      shouldShowNativeBtcLowSlippageWarning({
        fromToken: nativeBtc,
        toToken: wrappedBtc,
        slippage: 0.5,
        swapType: ESwapTabSwitchType.SWAP,
        isSwapPro: true,
      }),
    ).toBe(false);
  });

  it.each([ESwapTabSwitchType.LIMIT, ESwapTabSwitchType.STOCK])(
    'excludes %s orders',
    (swapType) => {
      expect(
        shouldShowNativeBtcLowSlippageWarning({
          fromToken: nativeBtc,
          toToken: wrappedBtc,
          slippage: 0.5,
          swapType,
        }),
      ).toBe(false);
    },
  );
});

describe('calculateMinToAmountBySlippage', () => {
  it('recomputes minimum received and rounds down to token decimals', () => {
    expect(
      calculateMinToAmountBySlippage({
        toTokenAmount: '1.23456789',
        toTokenDecimals: 6,
        slippage: NATIVE_BTC_MIN_SLIPPAGE_PERCENTAGE,
      }),
    ).toBe('1.222222');
  });

  it('rejects invalid amounts and slippage', () => {
    expect(
      calculateMinToAmountBySlippage({
        toTokenAmount: 'invalid',
        toTokenDecimals: 8,
        slippage: NATIVE_BTC_MIN_SLIPPAGE_PERCENTAGE,
      }),
    ).toBeUndefined();
    expect(
      calculateMinToAmountBySlippage({
        toTokenAmount: '1',
        toTokenDecimals: 8,
        slippage: 100,
      }),
    ).toBeUndefined();
  });
});

describe('invalidateSwapReviewForSlippageChange', () => {
  it('invalidates every build-derived field and marks provider context custom', () => {
    const quoteResultCtx = {
      hifiSwapQuoteResultCtx: {
        slippageType: 'Hardcoded',
      },
    };
    const reviewState = {
      steps: [],
      preSwapData: {
        toToken: {
          networkId: 'btc--0',
          contractAddress: '',
          symbol: 'BTC',
          decimals: 6,
          isNative: true,
        },
        toTokenAmount: '1.23456789',
        minToAmount: '1.23',
        slippage: 0.5,
        supportNetworkFeeLevel: true,
        swapBuildResultData: {
          orderId: 'stale-order',
        },
        netWorkFee: {
          gasFeeFiatValue: '12.34',
          gasInfos: [],
        },
      },
      quoteResult: {
        info: {
          provider: 'hifi',
          providerName: 'Hifi',
        },
        fromTokenInfo: {
          networkId: 'evm--1',
          contractAddress: '0xfrom',
        },
        toTokenInfo: {
          networkId: 'btc--0',
          contractAddress: '',
        },
        fromAmount: '10',
        toAmount: '1.23456789',
        minToAmount: '1.23',
        slippage: 0.5,
        quoteResultCtx,
      } as IFetchQuoteResult,
    };

    const result = invalidateSwapReviewForSlippageChange({
      reviewState,
      slippagePercentage: NATIVE_BTC_MIN_SLIPPAGE_PERCENTAGE,
    });

    expect(result.preSwapData).toEqual(
      expect.objectContaining({
        slippage: 1,
        minToAmount: '1.222222',
        swapBuildResultData: undefined,
        netWorkFee: undefined,
        supportNetworkFeeLevel: false,
        estimateNetworkFeeLoading: false,
        requiresSlippageRebuildOnConfirm: true,
      }),
    );
    expect(result.quoteResult).toEqual(
      expect.objectContaining({
        slippage: 1,
        minToAmount: '1.222222',
        quoteResultCtx: {
          hifiSwapQuoteResultCtx: {
            slippageType: 'Custom',
          },
        },
      }),
    );
    expect(reviewState.preSwapData.netWorkFee?.gasFeeFiatValue).toBe('12.34');
    expect(quoteResultCtx.hifiSwapQuoteResultCtx.slippageType).toBe(
      'Hardcoded',
    );
  });
});

describe('buildCustomSlippageQuoteResultCtx', () => {
  it('marks the active provider context as user-defined without mutating it', () => {
    const providerContext = {
      slippageType: 'Hardcoded',
      quoteFromAmount: '10',
      quoteToAmount: '20',
    };
    const quoteResultCtx = { hifiSwapQuoteResultCtx: providerContext };

    expect(buildCustomSlippageQuoteResultCtx(quoteResultCtx)).toEqual({
      hifiSwapQuoteResultCtx: {
        ...providerContext,
        slippageType: 'Custom',
      },
    });
    expect(quoteResultCtx.hifiSwapQuoteResultCtx).toBe(providerContext);
    expect(providerContext.slippageType).toBe('Hardcoded');
  });
});

describe('buildRebuiltSwapReviewQuoteResult', () => {
  it('keeps frozen execution context while accepting rebuilt quote fields', () => {
    const allowanceResult = {
      allowanceTarget: '0xspender',
      amount: '10',
    };
    const fromTokenInfo = {
      networkId: 'evm--1',
      contractAddress: '0xfrom-app',
    };
    const toTokenInfo = {
      networkId: 'evm--1',
      contractAddress: '0xto-app',
    };
    const quoteResultCtx = { okxQuoteResultCtx: { quoteFromAmount: '10' } };
    const quoteResult = {
      fromAmount: '10',
      toAmount: '20',
      minToAmount: '19',
      fromTokenInfo,
      toTokenInfo,
      allowanceResult,
      quoteResultCtx,
    } as IFetchQuoteResult;
    const buildResult = {
      ...quoteResult,
      toAmount: '21',
      minToAmount: '20.5',
      fromTokenInfo: {
        ...fromTokenInfo,
        contractAddress: '',
      },
      toTokenInfo: {
        ...toTokenInfo,
        contractAddress: '0xto-from-build-api',
      },
      allowanceResult: undefined,
      quoteResultCtx: undefined,
    } as IFetchBuildTxResult;

    const result = buildRebuiltSwapReviewQuoteResult({
      quoteResult,
      buildResult,
      slippagePercentage: 1,
    });

    expect(result).toEqual(
      expect.objectContaining({
        toAmount: '21',
        minToAmount: '20.5',
        slippage: 1,
        fromTokenInfo,
        toTokenInfo,
        allowanceResult,
        quoteResultCtx,
      }),
    );
  });
});

describe('resolveSwapReviewNeedFetchGasAfterRebuild', () => {
  it('preserves approval-dependent gas refresh after a successful rebuild', () => {
    expect(
      resolveSwapReviewNeedFetchGasAfterRebuild({
        fallbackToSeparateTxConfirm: false,
        previousNeedFetchGas: true,
      }),
    ).toBe(true);
  });

  it('keeps atomic batch transactions on their cached gas path', () => {
    expect(
      resolveSwapReviewNeedFetchGasAfterRebuild({
        fallbackToSeparateTxConfirm: false,
        previousNeedFetchGas: false,
      }),
    ).toBe(false);
  });

  it('forces a gas refresh when the rebuilt review falls back', () => {
    expect(
      resolveSwapReviewNeedFetchGasAfterRebuild({
        fallbackToSeparateTxConfirm: true,
        previousNeedFetchGas: false,
      }),
    ).toBe(true);
  });
});

describe('shouldCloseSwapReviewOnFocusLoss', () => {
  const baseParams = {
    isFocused: false,
    isAppLocked: false,
    hasInFlightSteps: false,
    initialRootRouterCount: 1,
    currentRootRouterCount: 1,
  };

  it('closes an open or pending review after the route actually loses focus', () => {
    expect(shouldCloseSwapReviewOnFocusLoss(baseParams)).toBe(true);
  });

  it('keeps an open or pending review while app lock covers the route', () => {
    expect(
      shouldCloseSwapReviewOnFocusLoss({
        ...baseParams,
        isAppLocked: true,
      }),
    ).toBe(false);
  });

  it('keeps an open or pending review while a root modal covers the route', () => {
    expect(
      shouldCloseSwapReviewOnFocusLoss({
        ...baseParams,
        currentRootRouterCount: 2,
      }),
    ).toBe(false);
  });

  it('keeps the review after a tab switch while a swap step is in flight', () => {
    expect(
      shouldCloseSwapReviewOnFocusLoss({
        ...baseParams,
        hasInFlightSteps: true,
      }),
    ).toBe(false);
  });
});

describe('hasInFlightSwapReviewSteps', () => {
  const step = (status: ESwapStepStatus) => ({ status }) as ISwapStep;

  it('does not treat prepared steps as in flight', () => {
    expect(
      hasInFlightSwapReviewSteps({
        steps: [step(ESwapStepStatus.READY)],
      }),
    ).toBe(false);
  });

  it.each([ESwapStepStatus.LOADING, ESwapStepStatus.PENDING])(
    'treats a %s step as in flight',
    (status) => {
      expect(
        hasInFlightSwapReviewSteps({
          steps: [step(status)],
        }),
      ).toBe(true);
    },
  );
});

describe('shouldShowSwapReviewToAmountSkeleton', () => {
  it('keeps the frozen quote amount visible while the build is loading', () => {
    expect(
      shouldShowSwapReviewToAmountSkeleton({
        swapBuildLoading: true,
        toTokenAmount: '21.4568',
      }),
    ).toBe(false);
  });

  it('shows a skeleton when the build is loading without an amount', () => {
    expect(
      shouldShowSwapReviewToAmountSkeleton({
        swapBuildLoading: true,
        toTokenAmount: '',
      }),
    ).toBe(true);
  });

  it('does not show a skeleton after the build settles', () => {
    expect(
      shouldShowSwapReviewToAmountSkeleton({
        swapBuildLoading: false,
        toTokenAmount: '',
      }),
    ).toBe(false);
  });
});
