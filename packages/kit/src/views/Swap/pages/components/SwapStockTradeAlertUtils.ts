import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  ISwapAlertState,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EStockTradeAlertType,
  ESwapAlertLevel,
  ESwapDirectionType,
} from '@onekeyhq/shared/types/swap/types';

import { isCurrentSwapAccountNetworkUnsupportedAlert } from '../../utils/swapNoWalletWarningGuard';
import { isSameStockTradeAmount } from '../../utils/swapStockTradeControl';

export type ISwapStockQuoteEventErrorForAlert = {
  fromToken?: ISwapToken;
  fromTokenAmount?: string;
  isMarketOpen?: boolean;
  isStock?: boolean;
  message?: string;
  toToken?: ISwapToken;
};

export function isSameAlertMessage(a?: string, b?: string) {
  return Boolean(a && b && a.trim() === b.trim());
}

export function getStockErrorAlertLevel({
  message,
  notAvailableInRegionMessage,
}: {
  message: string;
  notAvailableInRegionMessage: string;
}) {
  const isRegionError =
    isSameAlertMessage(message, notAvailableInRegionMessage) ||
    message.toLowerCase().includes('region');
  return isRegionError ? ESwapAlertLevel.ERROR : ESwapAlertLevel.WARNING;
}

const MIN_AMOUNT_MESSAGE_REG_EXP = /\bmin(?:imum)?(?:\s+amount)?\b|最小|最低/i;
const MAX_AMOUNT_MESSAGE_REG_EXP =
  /\bmax(?:imum)?(?:\s+amount)?\b|too\s+large|price\s+impact|exceed|over\s+limit|最大|过大|超出|超过|限额|降低金额/i;
const REGION_MESSAGE_REG_EXP = /region|country|jurisdiction|地区|区域|国家/i;
const UNKNOWN_MESSAGE_REG_EXP = /unknown|未知/i;

export function getStockTradeAlertType({
  message,
  notAvailableInRegionMessage,
  isMarketClosed,
}: {
  message?: string;
  notAvailableInRegionMessage?: string;
  isMarketClosed?: boolean;
}) {
  if (isMarketClosed) {
    return EStockTradeAlertType.MARKET_CLOSED;
  }
  const normalizedMessage = message?.trim();
  if (!normalizedMessage) {
    return EStockTradeAlertType.OTHER;
  }
  if (
    (notAvailableInRegionMessage &&
      isSameAlertMessage(normalizedMessage, notAvailableInRegionMessage)) ||
    REGION_MESSAGE_REG_EXP.test(normalizedMessage)
  ) {
    return EStockTradeAlertType.REGION_RESTRICTED;
  }
  if (MIN_AMOUNT_MESSAGE_REG_EXP.test(normalizedMessage)) {
    return EStockTradeAlertType.MIN_AMOUNT;
  }
  if (MAX_AMOUNT_MESSAGE_REG_EXP.test(normalizedMessage)) {
    return EStockTradeAlertType.MAX_AMOUNT;
  }
  if (UNKNOWN_MESSAGE_REG_EXP.test(normalizedMessage)) {
    return EStockTradeAlertType.UNKNOWN;
  }
  return EStockTradeAlertType.OTHER;
}

export function isCurrentStockQuoteEventError({
  fromToken,
  fromTokenAmount,
  quoteEventError,
  toToken,
}: {
  fromToken?: ISwapToken;
  fromTokenAmount?: string;
  quoteEventError?: ISwapStockQuoteEventErrorForAlert;
  toToken?: ISwapToken;
}) {
  if (!quoteEventError || !fromToken || !toToken) {
    return false;
  }
  const isSameTokenPair =
    equalTokenNoCaseSensitive({
      token1: quoteEventError.fromToken,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: quoteEventError.toToken,
      token2: toToken,
    });
  if (!isSameTokenPair) {
    return false;
  }
  if (!quoteEventError.isStock) {
    return true;
  }
  return isSameStockTradeAmount({
    left: quoteEventError.fromTokenAmount,
    right: fromTokenAmount,
  });
}

export function isCurrentStockMarketClosedQuoteEventError({
  fromToken,
  fromTokenAmount,
  quoteEventError,
  toToken,
}: {
  fromToken?: ISwapToken;
  fromTokenAmount?: string;
  quoteEventError?: ISwapStockQuoteEventErrorForAlert;
  toToken?: ISwapToken;
}) {
  return Boolean(
    quoteEventError?.isStock &&
    quoteEventError.isMarketOpen === false &&
    isCurrentStockQuoteEventError({
      fromToken,
      fromTokenAmount,
      quoteEventError,
      toToken,
    }),
  );
}

export type IStockAccountNetworkContext = Omit<
  Parameters<typeof isCurrentSwapAccountNetworkUnsupportedAlert>[0],
  'alert' | 'directionType'
>;

export function filterStockAccountNetworkAlerts({
  alerts,
  accountNetworkContexts,
}: {
  alerts: ISwapAlertState[];
  accountNetworkContexts: Record<
    ESwapDirectionType,
    IStockAccountNetworkContext
  >;
}) {
  return alerts.filter((alert) => {
    if (!alert.isAccountNetworkUnsupported) return true;
    const directionType =
      alert.accountNetworkUnsupportedContext?.directionType ??
      ESwapDirectionType.FROM;
    return isCurrentSwapAccountNetworkUnsupportedAlert({
      alert,
      directionType,
      ...accountNetworkContexts[directionType],
    });
  });
}
