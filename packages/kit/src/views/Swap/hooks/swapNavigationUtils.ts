import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';

export type ISwapNavigationContext = {
  isInSwapTab: boolean;
  isInMarketDetail: boolean;
  isHasSwapModal: boolean;
  isSwapModalOnTheTop: boolean;
  hasModal: boolean;
};

// Every Market detail route that renders the embedded Swap panel, including the
// stock route, which is a separate route from the token detail routes.
const MARKET_DETAIL_ROUTES = new Set<string>([
  ETabMarketRoutes.MarketDetail,
  ETabMarketRoutes.MarketDetailV2,
  ETabMarketRoutes.MarketStockDetail,
  ETabMarketRoutes.MarketNativeDetail,
]);

export function isMarketDetailRoute(routeName?: string) {
  return routeName ? MARKET_DETAIL_ROUTES.has(routeName) : false;
}

const activeMarketSwapApprovalFlowIds = new Set<string>();

export function registerMarketSwapApprovalFlow(flowId: string) {
  activeMarketSwapApprovalFlowIds.add(flowId);
  return () => {
    activeMarketSwapApprovalFlowIds.delete(flowId);
  };
}

export function isMarketSwapApprovalFlowMounted(flowId?: string) {
  return Boolean(flowId && activeMarketSwapApprovalFlowIds.has(flowId));
}

export function isSwapApprovalFlowActive({
  isInSwapTab,
  isInMarketDetail,
  isHasSwapModal,
  isSwapModalOnTheTop,
  hasModal,
  marketSwapApprovalFlowId,
}: ISwapNavigationContext & { marketSwapApprovalFlowId?: string }) {
  return (
    (isInSwapTab && !hasModal) ||
    (!isInSwapTab && isSwapModalOnTheTop && isHasSwapModal) ||
    (isInMarketDetail &&
      isMarketSwapApprovalFlowMounted(marketSwapApprovalFlowId))
  );
}
