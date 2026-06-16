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

export function isStockPayToken(token?: IStockAnalyticsToken) {
  return STOCK_PAY_TOKEN_SYMBOLS.has(token?.symbol?.toUpperCase() ?? '');
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
  let resolvedTradeSide = tradeSide;
  if (!resolvedTradeSide) {
    if (fromIsPayToken && !toIsPayToken) {
      resolvedTradeSide = 'buy';
    } else if (!fromIsPayToken && toIsPayToken) {
      resolvedTradeSide = 'sell';
    }
  }
  const stockToken = resolvedTradeSide === 'sell' ? fromToken : toToken;

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
    tradeSide,
    stockTokenSymbol: stockToken?.symbol,
    stockTokenAddress: stockToken?.contractAddress,
    network: stockToken?.networkId,
  };
}
