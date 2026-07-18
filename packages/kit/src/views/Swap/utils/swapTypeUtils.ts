import {
  getSwapSupportCheckType,
  getVisibleSwapTabSwitchType,
} from '@onekeyhq/shared/src/utils/swapTypeUtils';
import {
  EProtocolOfExchange,
  ESwapProTradeType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchQuoteResult,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';

import { filterStockPayTokenCandidates } from '../hooks/swapStockChannelUtils';

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

// Single owner of the "stock tokens trade only against stable coins" rule:
// when the traded token is a stock, the counterparty candidate pool (both BUY
// pay tokens and SELL receive tokens) is the same stable-coin whitelist the
// stock channel uses — not merely "non-native", so WETH-class assets are
// excluded too.
export function filterSwapProCounterpartyTokens<T extends ISwapTokenBase>({
  tokens,
  isStockPair,
}: {
  tokens: T[];
  isStockPair: boolean;
}): T[] {
  return isStockPair ? filterStockPayTokenCandidates(tokens) : tokens;
}

// Single owner of the "LIMIT sources its pay tokens from defaultLimitTokens"
// rule, so the pay-token popover and the default-token init can't diverge.
export function getSwapProDefaultTokens<T extends ISwapTokenBase>({
  tradeType,
  defaultTokens,
  defaultLimitTokens,
}: {
  tradeType: ESwapProTradeType;
  defaultTokens: T[];
  defaultLimitTokens: T[];
}): T[] {
  if (tradeType === ESwapProTradeType.MARKET) {
    return defaultTokens;
  }
  return defaultLimitTokens;
}
