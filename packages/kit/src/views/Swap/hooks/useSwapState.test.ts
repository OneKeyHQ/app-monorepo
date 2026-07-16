import {
  EProtocolOfExchange,
  ESwapSlippageSegmentKey,
} from '@onekeyhq/shared/types/swap/types';

import {
  isSwapActionWaitingAutoSlippage,
  resolveSwapSlippagePercentageModeInfo,
} from './useSwapState';

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => false,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({}));

jest.mock('../../../states/jotai/contexts/swap', () => ({}));

jest.mock('./useSwapAccount', () => ({
  useSwapAddressInfo: jest.fn(),
}));

describe('Swap action effective slippage gate', () => {
  it('does not let global AUTO lock the first actionable quote when the session override is CUSTOM', () => {
    const { slippageItem } = resolveSwapSlippagePercentageModeInfo({
      swapSlippagePercentageMode: ESwapSlippageSegmentKey.AUTO,
      swapSlippagePercentageCustomValue: 0.5,
      swapSlippageOverride: {
        key: ESwapSlippageSegmentKey.CUSTOM,
        value: 1.2,
      },
    });

    expect(slippageItem).toEqual({
      key: ESwapSlippageSegmentKey.CUSTOM,
      value: 1.2,
    });
    expect(
      isSwapActionWaitingAutoSlippage({
        effectiveSlippageMode: slippageItem.key,
        quoteEventCompleted: false,
        quoteEventProviderCount: 1,
        quote: {
          protocol: EProtocolOfExchange.SWAP,
          unSupportSlippage: false,
        },
      }),
    ).toBe(false);
  });

  it('still waits when AUTO is the effective mode and its suggestion is pending', () => {
    expect(
      isSwapActionWaitingAutoSlippage({
        effectiveSlippageMode: ESwapSlippageSegmentKey.AUTO,
        quoteEventCompleted: false,
        quoteEventProviderCount: 1,
        quote: {
          protocol: EProtocolOfExchange.SWAP,
          unSupportSlippage: false,
        },
      }),
    ).toBe(true);
  });

  it('unlocks before settlement once an effective AUTO suggestion is present', () => {
    const { slippageItem } = resolveSwapSlippagePercentageModeInfo({
      autoSuggestedSlippage: 1.2,
      swapSlippagePercentageMode: ESwapSlippageSegmentKey.AUTO,
      swapSlippagePercentageCustomValue: 0.5,
    });

    expect(
      isSwapActionWaitingAutoSlippage({
        effectiveSlippageMode: slippageItem.key,
        quoteEventCompleted: false,
        quoteEventProviderCount: 1,
        quote: {
          autoSuggestedSlippage: 1.2,
          protocol: EProtocolOfExchange.SWAP,
          unSupportSlippage: false,
        },
      }),
    ).toBe(false);
  });
});
