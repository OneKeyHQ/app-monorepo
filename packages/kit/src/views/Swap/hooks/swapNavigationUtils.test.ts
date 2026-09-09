import {
  isSwapApprovalFlowActive,
  registerMarketSwapApprovalFlow,
} from './swapNavigationUtils';

const baseNavigationContext = {
  isInSwapTab: false,
  isInMarketDetail: false,
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

  it('treats a mounted Market embedded approval flow as active', () => {
    const unregister = registerMarketSwapApprovalFlow('market-flow-1');
    expect(
      isSwapApprovalFlowActive({
        ...baseNavigationContext,
        isInMarketDetail: true,
        hasModal: true,
        marketSwapApprovalFlowId: 'market-flow-1',
      }),
    ).toBe(true);
    unregister();
  });

  it('does not treat a Market modal approval as an embedded flow', () => {
    expect(
      isSwapApprovalFlowActive({
        ...baseNavigationContext,
        isInMarketDetail: true,
        hasModal: true,
      }),
    ).toBe(false);
  });

  it('allows recovery after the originating Market flow unmounts', () => {
    const unregister = registerMarketSwapApprovalFlow('market-flow-1');
    unregister();
    expect(
      isSwapApprovalFlowActive({
        ...baseNavigationContext,
        hasModal: true,
        marketSwapApprovalFlowId: 'market-flow-1',
      }),
    ).toBe(false);
  });

  it('does not let another mounted Market flow consume the approval', () => {
    const unregister = registerMarketSwapApprovalFlow('market-flow-2');
    expect(
      isSwapApprovalFlowActive({
        ...baseNavigationContext,
        isInMarketDetail: true,
        marketSwapApprovalFlowId: 'market-flow-1',
      }),
    ).toBe(false);
    unregister();
  });

  it('allows recovery after switching away from a cached Market detail', () => {
    const unregister = registerMarketSwapApprovalFlow('market-flow-1');
    expect(
      isSwapApprovalFlowActive({
        ...baseNavigationContext,
        marketSwapApprovalFlowId: 'market-flow-1',
      }),
    ).toBe(false);
    unregister();
  });
});
