import BigNumber from 'bignumber.js';

import { selectBestQuote } from '@onekeyhq/shared/src/utils/swapQuoteSortUtils';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

type ISwapActionableQuote = Pick<IFetchQuoteResult, 'toAmount'>;
type ISwapQuoteProviderIdentity = Pick<
  IFetchQuoteResult['info'],
  'provider' | 'providerName'
>;
export type ISwapQuoteSelectionIntent = {
  type: 'manual-provider';
  info: ISwapQuoteProviderIdentity;
};

type ISwapQuoteProgressInput = {
  quoteLoading: boolean;
  quoteEventFetching: boolean;
  quoteCurrentSelect?: ISwapActionableQuote;
};

type ISwapQuoteProgressState = {
  quoteLoading: boolean;
  quoteEventFetching: boolean;
  hasActionableQuote: boolean;
  isWaitingActionableQuote: boolean;
};

type ISwapQuoteEventFetchingInput = {
  quoteEventTotalCount: {
    count: number;
  };
  currentEventReceivedCount: number;
  quoteEventCompleted: boolean;
};

type ISwapCurrentQuoteInput = {
  currentEventSortedQuotes: IFetchQuoteResult[];
  selectionIntent?: ISwapQuoteSelectionIntent;
  quoteEventTotalCount: {
    count: number;
    eventId?: string;
  };
  currentEventProviderKeys: string[];
};

export function buildSwapQuoteProviderKey(quote: {
  info: ISwapQuoteProviderIdentity;
}) {
  return `${quote.info.provider}-${quote.info.providerName}`;
}

export function buildSwapManualProviderSelectionIntent(
  quote: { info: ISwapQuoteProviderIdentity } | undefined,
): ISwapQuoteSelectionIntent | undefined {
  if (!quote) {
    return undefined;
  }

  return {
    type: 'manual-provider',
    info: {
      provider: quote.info.provider,
      providerName: quote.info.providerName,
    },
  };
}

export function hasSwapCurrentEventProvider(
  quote: { info: ISwapQuoteProviderIdentity } | undefined,
  currentEventProviderKeys: string[],
) {
  if (!quote) {
    return false;
  }

  return currentEventProviderKeys.includes(buildSwapQuoteProviderKey(quote));
}

export function isSwapQuoteEventFetching({
  quoteEventTotalCount,
  currentEventReceivedCount,
  quoteEventCompleted,
}: ISwapQuoteEventFetchingInput) {
  return (
    quoteEventTotalCount.count > 0 &&
    !quoteEventCompleted &&
    currentEventReceivedCount < quoteEventTotalCount.count
  );
}

export function selectSwapCurrentQuote({
  currentEventSortedQuotes,
  selectionIntent,
  quoteEventTotalCount,
  currentEventProviderKeys,
}: ISwapCurrentQuoteInput) {
  if (selectionIntent?.type === 'manual-provider') {
    const manualQuote = currentEventSortedQuotes.find(
      (quote) =>
        buildSwapQuoteProviderKey(quote) ===
        buildSwapQuoteProviderKey(selectionIntent),
    );

    if (manualQuote) {
      if (isSwapQuoteActionable(manualQuote)) {
        return manualQuote;
      }

      return (
        selectBestQuote(
          currentEventSortedQuotes.filter(isSwapQuoteActionable),
        ) ?? manualQuote
      );
    }

    if (
      quoteEventTotalCount.count > 0 &&
      !hasSwapCurrentEventProvider(selectionIntent, currentEventProviderKeys)
    ) {
      return undefined;
    }
  }

  return selectBestQuote(currentEventSortedQuotes);
}

export function isSwapQuoteActionable(
  quoteCurrentSelect?: ISwapActionableQuote,
) {
  return new BigNumber(quoteCurrentSelect?.toAmount ?? 0).gt(0);
}

export function getSwapQuoteProgressState({
  quoteLoading,
  quoteEventFetching,
  quoteCurrentSelect,
}: ISwapQuoteProgressInput): ISwapQuoteProgressState {
  const hasActionableQuote = isSwapQuoteActionable(quoteCurrentSelect);

  return {
    quoteLoading,
    quoteEventFetching,
    hasActionableQuote,
    isWaitingActionableQuote:
      quoteLoading || (quoteEventFetching && !hasActionableQuote),
  };
}
