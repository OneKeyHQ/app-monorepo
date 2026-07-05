import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapAlertLevel } from '@onekeyhq/shared/types/swap/types';

import { isSameStockTradeAmount } from '../../utils/swapStockTradeControl';

export type ISwapStockQuoteEventErrorForAlert = {
  fromToken?: ISwapToken;
  fromTokenAmount?: string;
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
