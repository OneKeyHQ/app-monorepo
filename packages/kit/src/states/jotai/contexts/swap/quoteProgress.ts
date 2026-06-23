import BigNumber from 'bignumber.js';

import { selectBestQuote } from '@onekeyhq/shared/src/utils/swapQuoteSortUtils';
import {
  ESwapQuoteKind,
  type IFetchQuoteResult,
} from '@onekeyhq/shared/types/swap/types';

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
  quoteCurrentSelect?: IFetchQuoteResult;
  previousQuote?: IFetchQuoteResult;
  quoteEventTotalCount?: ISwapQuoteEventTotalCount;
  quoteEventCompleted?: boolean;
  quoteEventError?: { message?: string } | undefined;
};

type ISwapQuoteProgressState = {
  quoteLoading: boolean;
  quoteEventFetching: boolean;
  hasActionableQuote: boolean;
  hasPreviousActionableQuote: boolean;
  isWaitingActionableQuote: boolean;
  isInputQuoteLoading: boolean;
  phase: ESwapQuoteUiPhase;
  displayQuote?: IFetchQuoteResult;
  previousQuote?: IFetchQuoteResult;
};

type ISwapQuoteEventTotalCount = {
  count: number;
  eventId?: string;
};

type ISwapQuoteEventStateInput = {
  quoteEventTotalCount: ISwapQuoteEventTotalCount;
  quoteEventCompleted: boolean;
};

type ISwapQuoteEventFetchingInput = ISwapQuoteEventStateInput & {
  currentEventReceivedCount: number;
};

type ISwapQuoteEventProgressTotalCountInput = {
  quoteEventTotalCount: ISwapQuoteEventTotalCount;
  maxQuoteCount?: number;
};

type ISwapCurrentQuoteInput = {
  currentEventSortedQuotes: IFetchQuoteResult[];
  selectionIntent?: ISwapQuoteSelectionIntent;
  quoteEventTotalCount: ISwapQuoteEventTotalCount;
  currentEventProviderKeys: string[];
};

type ISwapPreviousQuoteInput = {
  quotes: IFetchQuoteResult[];
  quoteEventTotalCount: ISwapQuoteEventTotalCount;
  quoteLoading: boolean;
  quoteEventFetching: boolean;
};

export enum ESwapQuoteUiPhase {
  Idle = 'idle',
  Waiting = 'waiting',
  HasQuote = 'hasQuote',
  ZeroProvider = 'zeroProvider',
  Error = 'error',
  StaleRefreshing = 'staleRefreshing',
}

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
  const hasReceivedTotal =
    quoteEventTotalCount.count > 0 || Boolean(quoteEventTotalCount.eventId);
  return (
    hasReceivedTotal &&
    !quoteEventCompleted &&
    (quoteEventTotalCount.count === 0 ||
      currentEventReceivedCount < quoteEventTotalCount.count)
  );
}

export function hasSwapQuoteEventTotalCount({
  quoteEventTotalCount,
  quoteEventCompleted,
}: ISwapQuoteEventStateInput) {
  return (
    quoteEventTotalCount.count > 0 ||
    Boolean(quoteEventTotalCount.eventId) ||
    quoteEventCompleted
  );
}

export function hasSwapZeroProviderQuoteEvent({
  quoteEventTotalCount,
}: {
  quoteEventTotalCount: ISwapQuoteEventTotalCount;
}) {
  return (
    Boolean(quoteEventTotalCount.eventId) && quoteEventTotalCount.count === 0
  );
}

export function isSwapZeroProviderQuoteCompleted({
  quoteEventTotalCount,
  quoteEventCompleted,
}: ISwapQuoteEventStateInput) {
  return (
    quoteEventCompleted &&
    hasSwapZeroProviderQuoteEvent({ quoteEventTotalCount })
  );
}

export const SWAP_INCOGNITO_QUOTE_PROVIDER_COUNT_CAP = 2;

export function getSwapQuoteEventProgressTotalCount({
  quoteEventTotalCount,
  maxQuoteCount,
}: ISwapQuoteEventProgressTotalCountInput) {
  if (!maxQuoteCount || maxQuoteCount <= 0) {
    return quoteEventTotalCount;
  }

  return {
    ...quoteEventTotalCount,
    count: Math.min(quoteEventTotalCount.count, maxQuoteCount),
  };
}

export function isSwapQuoteActionable(
  quoteCurrentSelect?: ISwapActionableQuote,
) {
  return new BigNumber(quoteCurrentSelect?.toAmount ?? 0).gt(0);
}

export function isSwapQuoteInputAmountMatched({
  quote,
  fromAmount,
  toAmount,
}: {
  quote?: Pick<IFetchQuoteResult, 'kind' | 'fromAmount' | 'toAmount'>;
  fromAmount: string;
  toAmount: string;
}) {
  if (!quote) {
    return false;
  }
  if (quote.kind === ESwapQuoteKind.BUY) {
    return quote.toAmount === toAmount;
  }
  return quote.fromAmount === fromAmount;
}

export function isSwapQuoteFromCurrentEvent({
  quote,
  quoteEventTotalCount,
  quoteLoading,
  quoteEventFetching,
}: {
  quote?: IFetchQuoteResult;
  quoteEventTotalCount: ISwapQuoteEventTotalCount;
  quoteLoading: boolean;
  quoteEventFetching: boolean;
}) {
  if (!quote) {
    return false;
  }
  if (quoteEventTotalCount.eventId) {
    return quote.eventId === quoteEventTotalCount.eventId;
  }
  return !quoteLoading && !quoteEventFetching;
}

export function selectSwapPreviousActionableQuote({
  quotes,
  quoteEventTotalCount,
  quoteLoading,
  quoteEventFetching,
}: ISwapPreviousQuoteInput) {
  const previousQuotes = quotes.filter(
    (quote) =>
      isSwapQuoteActionable(quote) &&
      !isSwapQuoteFromCurrentEvent({
        quote,
        quoteEventTotalCount,
        quoteLoading,
        quoteEventFetching,
      }),
  );

  return selectBestQuote(previousQuotes);
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
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      if (isSwapQuoteActionable(manualQuote)) {
        return manualQuote;
      }

      return (
        selectBestQuote(
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
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

export function getSwapQuoteProgressState({
  quoteLoading,
  quoteEventFetching,
  quoteCurrentSelect,
  previousQuote,
  quoteEventTotalCount = { count: 0 },
  quoteEventCompleted = false,
  quoteEventError,
}: ISwapQuoteProgressInput): ISwapQuoteProgressState {
  const isCurrentQuoteForActiveEvent = isSwapQuoteFromCurrentEvent({
    quote: quoteCurrentSelect,
    quoteEventTotalCount,
    quoteLoading,
    quoteEventFetching,
  });
  const currentQuote = isCurrentQuoteForActiveEvent
    ? quoteCurrentSelect
    : undefined;
  const fallbackPreviousQuote =
    !isCurrentQuoteForActiveEvent && isSwapQuoteActionable(quoteCurrentSelect)
      ? quoteCurrentSelect
      : undefined;
  const displayPreviousQuote = previousQuote ?? fallbackPreviousQuote;
  const hasActionableQuote = isSwapQuoteActionable(currentQuote);
  const hasPreviousActionableQuote =
    isSwapQuoteActionable(displayPreviousQuote);
  const isQuoteRequesting = quoteLoading || quoteEventFetching;
  const hasTerminalQuoteEvent = hasSwapQuoteEventTotalCount({
    quoteEventTotalCount,
    quoteEventCompleted,
  });
  const hasCurrentQuoteFailure =
    quoteEventCompleted && hasTerminalQuoteEvent && !hasActionableQuote;

  let phase = ESwapQuoteUiPhase.Idle;
  let displayQuote = currentQuote;
  if (quoteEventError?.message) {
    phase = ESwapQuoteUiPhase.Error;
    displayQuote = undefined;
  } else if (hasActionableQuote) {
    phase = ESwapQuoteUiPhase.HasQuote;
  } else if (
    isSwapZeroProviderQuoteCompleted({
      quoteEventTotalCount,
      quoteEventCompleted,
    }) ||
    hasCurrentQuoteFailure
  ) {
    phase = ESwapQuoteUiPhase.ZeroProvider;
    displayQuote = undefined;
  } else if (isQuoteRequesting && hasPreviousActionableQuote) {
    phase = ESwapQuoteUiPhase.StaleRefreshing;
    displayQuote = displayPreviousQuote;
  } else if (isQuoteRequesting) {
    phase = ESwapQuoteUiPhase.Waiting;
  } else if (hasPreviousActionableQuote) {
    phase = ESwapQuoteUiPhase.HasQuote;
    displayQuote = displayPreviousQuote;
  }

  return {
    quoteLoading,
    quoteEventFetching,
    hasActionableQuote,
    hasPreviousActionableQuote,
    isWaitingActionableQuote: isQuoteRequesting && !hasActionableQuote,
    isInputQuoteLoading: phase === ESwapQuoteUiPhase.Waiting,
    phase,
    displayQuote,
    previousQuote: displayPreviousQuote,
  };
}
