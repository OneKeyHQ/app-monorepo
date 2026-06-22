import {
  getSwapSupportCheckType,
  getVisibleSwapTabSwitchType,
} from '@onekeyhq/shared/src/utils/swapTypeUtils';
import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

export { getSwapSupportCheckType, getVisibleSwapTabSwitchType };

export function getVisibleSwapTabSwitchUpdate({
  currentSwapType,
  nextSwapType,
}: {
  currentSwapType: ESwapTabSwitchType;
  nextSwapType: ESwapTabSwitchType;
}) {
  const nextVisibleSwapType =
    getVisibleSwapTabSwitchType(nextSwapType) ?? nextSwapType;
  const currentVisibleSwapType =
    getVisibleSwapTabSwitchType(currentSwapType) ?? currentSwapType;

  return {
    nextVisibleSwapType,
    shouldUpdate:
      nextVisibleSwapType !== currentVisibleSwapType ||
      currentSwapType !== currentVisibleSwapType,
  };
}

export function getSwapNetworkSupportTabSwitchTypes({
  supportSingleSwap,
  supportCrossChainSwap,
  supportLimit,
  supportStock,
}: {
  supportSingleSwap?: boolean;
  supportCrossChainSwap?: boolean;
  supportLimit?: boolean;
  supportStock?: boolean;
}) {
  const supportTypes: ESwapTabSwitchType[] = [];
  if (supportSingleSwap || supportCrossChainSwap) {
    supportTypes.push(ESwapTabSwitchType.SWAP);
  }
  if (supportCrossChainSwap) {
    supportTypes.push(ESwapTabSwitchType.BRIDGE);
  }
  if (supportLimit) {
    supportTypes.push(ESwapTabSwitchType.LIMIT);
  }
  if (supportStock) {
    supportTypes.push(ESwapTabSwitchType.STOCK);
  }
  return supportTypes;
}

export function getSwapExecutionType({
  protocol,
  fromNetworkId,
  toNetworkId,
}: {
  protocol?: EProtocolOfExchange;
  fromNetworkId?: string;
  toNetworkId?: string;
}) {
  if (protocol === EProtocolOfExchange.LIMIT) {
    return ESwapTabSwitchType.LIMIT;
  }
  if (protocol === EProtocolOfExchange.STOCK) {
    return ESwapTabSwitchType.STOCK;
  }
  if (fromNetworkId && toNetworkId && fromNetworkId !== toNetworkId) {
    return ESwapTabSwitchType.BRIDGE;
  }
  return ESwapTabSwitchType.SWAP;
}

export function getSwapExecutionTypeFromQuoteResult(
  quoteResult?: IFetchQuoteResult,
) {
  return getSwapExecutionType({
    protocol: quoteResult?.protocol,
    fromNetworkId: quoteResult?.fromTokenInfo.networkId,
    toNetworkId: quoteResult?.toTokenInfo.networkId,
  });
}
