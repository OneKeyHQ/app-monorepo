import {
  hasSwapCurrentEventProvider,
  isSwapQuoteActionable,
  isSwapQuoteInputAmountMatched,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/quoteProgress';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

export function isSwapProviderQuoteSelectable({
  currentEventId,
  currentEventProviderKeys,
  fromAmount,
  quote,
  toAmount,
}: {
  currentEventId: string | undefined;
  currentEventProviderKeys: string[];
  fromAmount: string;
  quote: IFetchQuoteResult;
  toAmount: string;
}) {
  // Each exact-out provider may require a different fromAmount. Validate the
  // candidate against its own transport contract instead of reusing the
  // currently selected provider's derived input amount. Input matching remains
  // kind-aware so retained rows from the previous request are display-only.
  return (
    hasSwapCurrentEventProvider(quote, currentEventProviderKeys) &&
    (!currentEventId || quote.eventId === currentEventId) &&
    isSwapQuoteInputAmountMatched({ quote, fromAmount, toAmount }) &&
    isSwapQuoteActionable(quote)
  );
}
