import {
  ESwapTabSwitchType,
  ESwapTipsEffectiveTab,
} from '@onekeyhq/shared/types/swap/types';

export function shouldShowSwapTips({
  effectiveTab,
  swapType,
}: {
  effectiveTab?: ESwapTipsEffectiveTab[];
  swapType: ESwapTabSwitchType;
}) {
  if (!effectiveTab?.length) {
    return true;
  }

  if (effectiveTab.includes(ESwapTipsEffectiveTab.ALL)) {
    return true;
  }

  if (
    swapType === ESwapTabSwitchType.SWAP ||
    swapType === ESwapTabSwitchType.BRIDGE
  ) {
    return effectiveTab.includes(ESwapTipsEffectiveTab.SWAP_AND_BRIDGE);
  }

  if (swapType === ESwapTabSwitchType.STOCK) {
    return effectiveTab.includes(ESwapTipsEffectiveTab.STOCKS);
  }

  if (swapType === ESwapTabSwitchType.LIMIT) {
    return effectiveTab.includes(ESwapTipsEffectiveTab.LIMIT);
  }

  return false;
}
