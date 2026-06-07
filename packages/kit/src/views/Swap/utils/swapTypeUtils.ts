import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

export function getVisibleSwapTabSwitchType(type?: ESwapTabSwitchType) {
  return type === ESwapTabSwitchType.BRIDGE ? ESwapTabSwitchType.SWAP : type;
}

export function getSwapSupportCheckType(type?: ESwapTabSwitchType) {
  return type === ESwapTabSwitchType.BRIDGE
    ? ESwapTabSwitchType.BRIDGE
    : getVisibleSwapTabSwitchType(type);
}

export function getSwapNetworkSupportTabSwitchTypes({
  supportSingleSwap,
  supportCrossChainSwap,
  supportLimit,
}: {
  supportSingleSwap?: boolean;
  supportCrossChainSwap?: boolean;
  supportLimit?: boolean;
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
