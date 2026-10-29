import {
  getSwapQuoteLimitError,
  isSwapQuoteAvailable,
} from '@onekeyhq/kit/src/views/Swap/utils/swapErrorUtils';
import { sortSwapQuotes } from '@onekeyhq/shared/src/utils/swapQuoteSortUtils';
import { ESwapProviderSort } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

export function selectPrivateSendQuote(
  quotes: IFetchQuoteResult[],
  fromTokenAmount: string,
): IFetchQuoteResult | undefined {
  const usableQuotes = quotes.filter((quote) =>
    isSwapQuoteAvailable(quote, fromTokenAmount),
  );
  return (
    sortSwapQuotes(usableQuotes, {
      sort: ESwapProviderSort.RECOMMENDED,
      fromTokenAmount,
    })[0] ??
    quotes.find(
      (quote) =>
        quote.info.provider &&
        getSwapQuoteLimitError({ limit: quote.limit, fromTokenAmount }),
    ) ??
    quotes.find((quote) => quote.info.provider) ??
    quotes[0]
  );
}
