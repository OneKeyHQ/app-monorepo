import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  NATIVE_BTC_MIN_SLIPPAGE_PERCENTAGE,
  calculateMinToAmountBySlippage,
  shouldShowNativeBtcLowSlippageWarning,
  shouldShowSwapReviewToAmountSkeleton,
} from './swapReviewState';

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

  it('excludes limit orders', () => {
    expect(
      shouldShowNativeBtcLowSlippageWarning({
        fromToken: nativeBtc,
        toToken: wrappedBtc,
        slippage: 0.5,
        swapType: ESwapTabSwitchType.LIMIT,
      }),
    ).toBe(false);
  });
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
