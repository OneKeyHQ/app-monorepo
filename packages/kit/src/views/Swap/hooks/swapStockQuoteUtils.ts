import type {
  IFetchQuoteResult,
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';

import { isQuoteResultForStockTrade } from '../utils/swapStockTradeControl';

export { isQuoteResultForStockTrade };

export function resolveStockEstimatedReceiveQuoteState({
  displayQuoteResult,
  executionQuoteResult,
  forceHideQuote,
  receiveToken,
  sendAmount,
  sendToken,
}: {
  displayQuoteResult?: IFetchQuoteResult;
  executionQuoteResult?: IFetchQuoteResult;
  forceHideQuote?: boolean;
  receiveToken?: ISwapTokenBase;
  sendAmount?: string;
  sendToken?: ISwapToken;
}) {
  const executionQuoteMatched =
    !forceHideQuote &&
    isQuoteResultForStockTrade({
      quoteResult: executionQuoteResult,
      receiveToken,
      sendAmount,
      sendToken,
    });
  const displayQuoteCandidate = displayQuoteResult ?? executionQuoteResult;
  const displayQuoteMatched =
    !forceHideQuote &&
    isQuoteResultForStockTrade({
      quoteResult: displayQuoteCandidate,
      receiveToken,
      sendAmount,
      sendToken,
    });

  return {
    displayQuote: displayQuoteMatched ? displayQuoteCandidate : undefined,
    executionQuoteToAmount: executionQuoteMatched
      ? executionQuoteResult?.toAmount
      : undefined,
  };
}
