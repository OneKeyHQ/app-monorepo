import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import { ESwapSource } from '@onekeyhq/shared/types/swap/types';

import {
  isMarketEmbeddedSwapRoute,
  isSwapApprovalFlowActive,
} from './swapNavigationUtils';

const baseNavigationContext = {
  isInSwapTab: false,
  isInMarketEmbeddedSwap: false,
  isHasSwapModal: false,
  isSwapModalOnTheTop: false,
  hasModal: false,
};

describe('isSwapApprovalFlowActive', () => {
  it('keeps the existing active Swap page behavior', () => {
    expect(
      isSwapApprovalFlowActive({
        ...baseNavigationContext,
        isInSwapTab: true,
      }),
    ).toBe(true);
  });

  it('keeps the existing topmost Swap modal behavior', () => {
    expect(
      isSwapApprovalFlowActive({
        ...baseNavigationContext,
        isHasSwapModal: true,
        isSwapModalOnTheTop: true,
        hasModal: true,
      }),
    ).toBe(true);
  });

  it('treats a Market approval as active behind its transaction modal', () => {
    expect(
      isSwapApprovalFlowActive({
        ...baseNavigationContext,
        isInMarketEmbeddedSwap: true,
        hasModal: true,
        swapSource: ESwapSource.MARKET,
      }),
    ).toBe(true);
  });

  it('does not treat an unrelated Swap approval as active on Market', () => {
    expect(
      isSwapApprovalFlowActive({
        ...baseNavigationContext,
        isInMarketEmbeddedSwap: true,
        hasModal: true,
        swapSource: ESwapSource.TAB,
      }),
    ).toBe(false);
  });

  it('allows recovery after leaving the originating Market flow', () => {
    expect(
      isSwapApprovalFlowActive({
        ...baseNavigationContext,
        hasModal: true,
        swapSource: ESwapSource.MARKET,
      }),
    ).toBe(false);
  });
});

describe('isMarketEmbeddedSwapRoute', () => {
  it.each([
    ETabMarketRoutes.MarketDetail,
    ETabMarketRoutes.MarketDetailV2,
    ETabMarketRoutes.MarketNativeDetail,
  ])('recognizes the Market route that owns embedded Swap: %s', (routeName) => {
    expect(isMarketEmbeddedSwapRoute(routeName)).toBe(true);
  });

  it('does not treat the Market home as an active embedded Swap flow', () => {
    expect(isMarketEmbeddedSwapRoute(ETabMarketRoutes.TabMarket)).toBe(false);
  });
});
