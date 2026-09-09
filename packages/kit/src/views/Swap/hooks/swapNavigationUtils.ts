import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import { ESwapSource } from '@onekeyhq/shared/types/swap/types';

export type ISwapNavigationContext = {
  isInSwapTab: boolean;
  isInMarketEmbeddedSwap: boolean;
  isHasSwapModal: boolean;
  isSwapModalOnTheTop: boolean;
  hasModal: boolean;
};

export function isMarketEmbeddedSwapRoute(routeName?: string) {
  return (
    routeName === ETabMarketRoutes.MarketDetail ||
    routeName === ETabMarketRoutes.MarketDetailV2 ||
    routeName === ETabMarketRoutes.MarketNativeDetail
  );
}

export function isSwapApprovalFlowActive({
  isInSwapTab,
  isInMarketEmbeddedSwap,
  isHasSwapModal,
  isSwapModalOnTheTop,
  hasModal,
  swapSource,
}: ISwapNavigationContext & { swapSource?: ESwapSource }) {
  return (
    (isInSwapTab && !hasModal) ||
    (!isInSwapTab && isSwapModalOnTheTop && isHasSwapModal) ||
    (isInMarketEmbeddedSwap && swapSource === ESwapSource.MARKET)
  );
}
