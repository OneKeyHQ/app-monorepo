import type {
  EStockTradeAlertType,
  IFetchQuoteResult,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapAnalyticsCategory,
  ESwapAnalyticsEnterFrom,
  ESwapDirectionType,
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

type IStockAnalyticsToken = Partial<ISwapTokenBase> | undefined;

const STOCK_PAY_TOKEN_SYMBOLS = new Set(['USDC', 'USDT']);

export const SWAP_STOCK_ANALYTICS_ORDER_TYPE = EProtocolOfExchange.STOCK;
export const SWAP_STOCK_ANALYTICS_TOKEN_ROLE_STOCK = 'stock';
export const SWAP_STOCK_ANALYTICS_TOKEN_ROLE_PAY = 'pay';
export const SWAP_STOCK_ANALYTICS_TOKEN_LIST_TYPE_STOCK = 'stock';
export const SWAP_STOCK_ANALYTICS_TOKEN_LIST_TYPE_DEFAULT = 'default';
export const SWAP_STOCK_ANALYTICS_TRADE_SIDE_BUY = 'Buy';
export const SWAP_STOCK_ANALYTICS_TRADE_SIDE_SELL = 'Sell';

export function getSwapAnalyticsCategoryFromSwapType(
  swapType?: ESwapTabSwitchType,
) {
  if (swapType === ESwapTabSwitchType.BRIDGE) {
    return ESwapAnalyticsCategory.BRIDGE;
  }
  if (swapType === ESwapTabSwitchType.LIMIT) {
    return ESwapAnalyticsCategory.LIMIT;
  }
  if (swapType === ESwapTabSwitchType.STOCK) {
    return ESwapAnalyticsCategory.STOCK;
  }
  return ESwapAnalyticsCategory.SWAP;
}

export function getSwapAnalyticsCategory({
  protocol,
  fromNetworkId,
  toNetworkId,
}: {
  protocol?: EProtocolOfExchange;
  fromNetworkId?: string;
  toNetworkId?: string;
}) {
  if (protocol === EProtocolOfExchange.LIMIT) {
    return ESwapAnalyticsCategory.LIMIT;
  }
  if (protocol === EProtocolOfExchange.STOCK) {
    return ESwapAnalyticsCategory.STOCK;
  }
  if (fromNetworkId && toNetworkId && fromNetworkId !== toNetworkId) {
    return ESwapAnalyticsCategory.BRIDGE;
  }
  return ESwapAnalyticsCategory.SWAP;
}

export function getSwapAnalyticsCategoryFromQuoteResult(
  quoteResult?: IFetchQuoteResult,
) {
  return getSwapAnalyticsCategory({
    protocol: quoteResult?.protocol,
    fromNetworkId: quoteResult?.fromTokenInfo.networkId,
    toNetworkId: quoteResult?.toTokenInfo.networkId,
  });
}

export function getSwapAnalyticsEnterFrom(enterFrom?: ESwapSource) {
  if (
    enterFrom === ESwapSource.WALLET_TAB ||
    enterFrom === ESwapSource.WALLET_HOME ||
    enterFrom === ESwapSource.WALLET_HOME_TOKEN_LIST ||
    enterFrom === ESwapSource.WALLET_HOME_POPULAR_TRADING ||
    enterFrom === ESwapSource.TAB
  ) {
    return ESwapAnalyticsEnterFrom.HOME_TAB;
  }
  if (enterFrom === ESwapSource.TOKEN_DETAIL) {
    return ESwapAnalyticsEnterFrom.TOKEN_DETAIL;
  }
  if (enterFrom === ESwapSource.MARKET) {
    return ESwapAnalyticsEnterFrom.MARKET;
  }
  if (enterFrom === ESwapSource.EARN) {
    return ESwapAnalyticsEnterFrom.EARN;
  }
  return ESwapAnalyticsEnterFrom.OTHERS;
}

export function isStockPayToken(token?: IStockAnalyticsToken) {
  return STOCK_PAY_TOKEN_SYMBOLS.has(token?.symbol?.toUpperCase() ?? '');
}

function normalizeStockTradeSide(tradeSide?: string) {
  if (!tradeSide) {
    return undefined;
  }
  const normalizedTradeSide = tradeSide.toLowerCase();
  if (normalizedTradeSide === 'buy') {
    return SWAP_STOCK_ANALYTICS_TRADE_SIDE_BUY;
  }
  if (normalizedTradeSide === 'sell') {
    return SWAP_STOCK_ANALYTICS_TRADE_SIDE_SELL;
  }
  return tradeSide;
}

export function getSwapAnalyticsTokenListType({
  from,
  swapType,
}: {
  from?: ESwapTabSwitchType | 'pro';
  swapType?: ESwapTabSwitchType;
}) {
  if (from === 'pro') {
    return 'limit';
  }
  return swapType ?? from ?? 'swap';
}

export function getSwapAnalyticsTokenRole(direction?: ESwapDirectionType) {
  if (direction === ESwapDirectionType.FROM) {
    return 'from';
  }
  if (direction === ESwapDirectionType.TO) {
    return 'to';
  }
  return undefined;
}

export function getStockTradeAnalyticsPayload({
  protocol,
  fromToken,
  toToken,
  tradeSide,
}: {
  protocol?: EProtocolOfExchange;
  fromToken?: IStockAnalyticsToken;
  toToken?: IStockAnalyticsToken;
  tradeSide?: string;
}) {
  if (protocol !== EProtocolOfExchange.STOCK) {
    return {};
  }

  const fromIsPayToken = isStockPayToken(fromToken);
  const toIsPayToken = isStockPayToken(toToken);
  let resolvedTradeSide = normalizeStockTradeSide(tradeSide);
  if (!resolvedTradeSide) {
    if (fromIsPayToken && !toIsPayToken) {
      resolvedTradeSide = SWAP_STOCK_ANALYTICS_TRADE_SIDE_BUY;
    } else if (!fromIsPayToken && toIsPayToken) {
      resolvedTradeSide = SWAP_STOCK_ANALYTICS_TRADE_SIDE_SELL;
    }
  }
  const stockToken =
    resolvedTradeSide === SWAP_STOCK_ANALYTICS_TRADE_SIDE_SELL
      ? fromToken
      : toToken;

  return {
    tradeSide: resolvedTradeSide,
    stockTokenSymbol: stockToken?.symbol,
    stockTokenAddress: stockToken?.contractAddress,
  };
}

export function getStockTradeAlertAnalyticsPayload({
  alertType,
  alertLevel,
  tradeDisabled,
  tradeSide,
  stockToken,
}: {
  alertType: EStockTradeAlertType;
  alertLevel?: string;
  tradeDisabled?: boolean;
  tradeSide?: string;
  stockToken?: IStockAnalyticsToken;
}) {
  return {
    alertType,
    alertLevel,
    tradeDisabled,
    tradeSide: normalizeStockTradeSide(tradeSide),
    stockTokenSymbol: stockToken?.symbol,
    stockTokenAddress: stockToken?.contractAddress,
    network: stockToken?.networkId,
  };
}
