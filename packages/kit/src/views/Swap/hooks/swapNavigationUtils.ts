import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';

export type ISwapNavigationContext = {
  isInSwapTab: boolean;
  isInMarketDetail: boolean;
  // The Wallet tab on its own home, where the desktop trade column docks.
  isInHomeTab: boolean;
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

// Where an embedded Swap form shows its review: Market detail, or the desktop
// home's trade column.
export type IEmbeddedSwapApprovalFlowHost = 'marketDetail' | 'homeTab';

const activeMarketSwapApprovalFlowIds = new Map<
  string,
  IEmbeddedSwapApprovalFlowHost
>();

export function registerMarketSwapApprovalFlow(
  flowId: string,
  host: IEmbeddedSwapApprovalFlowHost = 'marketDetail',
) {
  activeMarketSwapApprovalFlowIds.set(flowId, host);
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
  isInHomeTab,
  isHasSwapModal,
  isSwapModalOnTheTop,
  hasModal,
  marketSwapApprovalFlowId,
}: ISwapNavigationContext & { marketSwapApprovalFlowId?: string }) {
  const embeddedFlowHost = marketSwapApprovalFlowId
    ? activeMarketSwapApprovalFlowIds.get(marketSwapApprovalFlowId)
    : undefined;
  return (
    (isInSwapTab && !hasModal) ||
    (!isInSwapTab && isSwapModalOnTheTop && isHasSwapModal) ||
    (isInMarketDetail && embeddedFlowHost === 'marketDetail') ||
    (isInHomeTab && embeddedFlowHost === 'homeTab')
  );
}
