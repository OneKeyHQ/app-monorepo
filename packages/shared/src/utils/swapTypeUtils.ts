import { ESwapTabSwitchType } from '../../types/swap/types';

export function getVisibleSwapTabSwitchType(type?: ESwapTabSwitchType) {
  return type === ESwapTabSwitchType.BRIDGE ? ESwapTabSwitchType.SWAP : type;
}

export function getSwapSupportCheckType(type?: ESwapTabSwitchType) {
  return type === ESwapTabSwitchType.BRIDGE
    ? ESwapTabSwitchType.BRIDGE
    : getVisibleSwapTabSwitchType(type);
}
