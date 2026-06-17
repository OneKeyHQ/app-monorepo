import type {
  ESwapTabSwitchType,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapDirectionType,
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
  alertType: string;
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
