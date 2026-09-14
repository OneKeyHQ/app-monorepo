export type ISwapNavigationContext = {
  isInSwapTab: boolean;
  isInMarketDetail: boolean;
  isHasSwapModal: boolean;
  isSwapModalOnTheTop: boolean;
  hasModal: boolean;
};

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
