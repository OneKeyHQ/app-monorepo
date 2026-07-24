import {
  ESwapTabSwitchType,
  ESwapTipsEffectiveTab,
} from '@onekeyhq/shared/types/swap/types';

import { shouldShowSwapTips } from './SwapTipsContainer.utils';

describe('SwapTipsContainer utils', () => {
  it('keeps the legacy display behavior when effectiveTab is missing or empty', () => {
    expect(
      shouldShowSwapTips({
        swapType: ESwapTabSwitchType.SWAP,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapTips({
        effectiveTab: [],
        swapType: ESwapTabSwitchType.STOCK,
      }),
    ).toBe(true);
  });

  it('shows All tips on every supported trade tab', () => {
    const effectiveTab = [ESwapTipsEffectiveTab.ALL];

    expect(
      shouldShowSwapTips({
        effectiveTab,
        swapType: ESwapTabSwitchType.SWAP,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapTips({
        effectiveTab,
        swapType: ESwapTabSwitchType.STOCK,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapTips({
        effectiveTab,
        swapType: ESwapTabSwitchType.LIMIT,
      }),
    ).toBe(true);
  });

  it('maps Swap&Bridge tips to both execution types', () => {
    const effectiveTab = [ESwapTipsEffectiveTab.SWAP_AND_BRIDGE];

    expect(
      shouldShowSwapTips({
        effectiveTab,
        swapType: ESwapTabSwitchType.SWAP,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapTips({
        effectiveTab,
        swapType: ESwapTabSwitchType.BRIDGE,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapTips({
        effectiveTab,
        swapType: ESwapTabSwitchType.STOCK,
      }),
    ).toBe(false);
  });

  it('shows Stocks and Limit tips only on their configured tabs', () => {
    expect(
      shouldShowSwapTips({
        effectiveTab: [ESwapTipsEffectiveTab.STOCKS],
        swapType: ESwapTabSwitchType.STOCK,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapTips({
        effectiveTab: [ESwapTipsEffectiveTab.STOCKS],
        swapType: ESwapTabSwitchType.SWAP,
      }),
    ).toBe(false);
    expect(
      shouldShowSwapTips({
        effectiveTab: [ESwapTipsEffectiveTab.LIMIT],
        swapType: ESwapTabSwitchType.LIMIT,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapTips({
        effectiveTab: [ESwapTipsEffectiveTab.LIMIT],
        swapType: ESwapTabSwitchType.STOCK,
      }),
    ).toBe(false);
  });

  it('supports multiple configured tabs without adding page-level conditions', () => {
    const effectiveTab = [
      ESwapTipsEffectiveTab.STOCKS,
      ESwapTipsEffectiveTab.LIMIT,
    ];

    expect(
      shouldShowSwapTips({
        effectiveTab,
        swapType: ESwapTabSwitchType.STOCK,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapTips({
        effectiveTab,
        swapType: ESwapTabSwitchType.LIMIT,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapTips({
        effectiveTab,
        swapType: ESwapTabSwitchType.SWAP,
      }),
    ).toBe(false);
  });
});
