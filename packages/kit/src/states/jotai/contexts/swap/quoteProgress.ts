import BigNumber from 'bignumber.js';

import { selectBestQuote } from '@onekeyhq/shared/src/utils/swapQuoteSortUtils';
import {
  ESwapQuoteKind,
  type IFetchQuoteResult,
} from '@onekeyhq/shared/types/swap/types';

type ISwapActionableQuote = Pick<
  IFetchQuoteResult,
  'errorMessage' | 'fromAmount' | 'kind' | 'limit' | 'toAmount'
>;
type ISwapQuoteProviderIdentity = Pick<
  IFetchQuoteResult['info'],
  'provider' | 'providerName'
>;
export type ISwapQuoteSelectionIntent = {
  type: 'manual-provider';
  info: ISwapQuoteProviderIdentity;
  quoteSnapshot?: IFetchQuoteResult;
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

export type ISwapQuoteEventTotalCount = {
  count: number;
  eventId?: string;
  totalQuoteCountReceived?: boolean;
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
  quoteEventCompleted?: boolean;
  deferNonActionableQuoteUntilEventSettled?: boolean;
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
  quote:
    | ({ info: ISwapQuoteProviderIdentity } & Partial<IFetchQuoteResult>)
    | undefined,
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
    ...(quote.fromTokenInfo && quote.toTokenInfo
      ? { quoteSnapshot: quote as IFetchQuoteResult }
      : {}),
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
  if (quoteEventTotalCount.totalQuoteCountReceived === false) {
    return !quoteEventCompleted;
  }

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

export function isSwapNoProviderSupportsTrade({
  zeroProviderQuoteCompleted,
  quote,
  quoteResultNoMatch,
}: {
  zeroProviderQuoteCompleted: boolean;
  quote?: Pick<IFetchQuoteResult, 'toAmount' | 'limit'>;
  quoteResultNoMatch: boolean;
}) {
  // Only trust the no-provider verdict when the quote belongs to the current
  // inputs; a stale mismatched quote must not lock the action button out of
  // its "Refresh quotes" recovery state. (OK-57545)
  return (
    (zeroProviderQuoteCompleted ||
      Boolean(quote && !quote.toAmount && !quote.limit)) &&
    !quoteResultNoMatch
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
  if (!quoteCurrentSelect) {
    return false;
  }
  if (quoteCurrentSelect?.errorMessage) {
    return false;
  }
  const toAmount = new BigNumber(quoteCurrentSelect?.toAmount ?? 0);
  if (!toAmount.isFinite() || !toAmount.gt(0)) {
    return false;
  }
  if (!quoteCurrentSelect.limit) {
    return true;
  }
  const inputAmount = new BigNumber(
    quoteCurrentSelect.fromAmount ?? Number.NaN,
  );
  if (!inputAmount.isFinite() || inputAmount.isNegative()) {
    return false;
  }
  if (quoteCurrentSelect.limit.min) {
    const min = new BigNumber(quoteCurrentSelect.limit.min);
    if (!min.isFinite() || inputAmount.lt(min)) {
      return false;
    }
  }
  if (quoteCurrentSelect.limit.max) {
    const max = new BigNumber(quoteCurrentSelect.limit.max);
    if (!max.isFinite() || inputAmount.gt(max)) {
      return false;
    }
  }
  return true;
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
  quoteEventCompleted = false,
  deferNonActionableQuoteUntilEventSettled = false,
}: ISwapCurrentQuoteInput) {
  const actionableQuotes = currentEventSortedQuotes.filter(
    isSwapQuoteActionable,
  );
  const isWaitingForAuthoritativeTotalCount =
    quoteEventTotalCount.totalQuoteCountReceived === false;
  const isWaitingForMoreProviders =
    quoteEventTotalCount.count > currentEventProviderKeys.length;
  const shouldDeferNonActionableQuote =
    deferNonActionableQuoteUntilEventSettled &&
    !quoteEventCompleted &&
    (isWaitingForAuthoritativeTotalCount || isWaitingForMoreProviders) &&
    actionableQuotes.length === 0;

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
          actionableQuotes,
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

  if (shouldDeferNonActionableQuote) {
    return undefined;
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
    // A failed refresh must revoke execution ownership, but it does not need
    // to erase an already committed value for the same intent. Keeping the
    // display projection stable avoids amount -> empty/skeleton oscillation;
    // the executable selector remains empty until a later request settles.
    displayQuote = hasPreviousActionableQuote
      ? displayPreviousQuote
      : undefined;
  } else if (hasActionableQuote) {
    // The committed-state owner pins the first actionable provider for this
    // request, so publishing it here ends the skeleton without exposing every
    // later provider update to the main amount or Review button.
    phase = ESwapQuoteUiPhase.HasQuote;
    displayQuote = currentQuote;
  } else if (isQuoteRequesting && hasPreviousActionableQuote) {
    phase = ESwapQuoteUiPhase.StaleRefreshing;
    displayQuote = displayPreviousQuote;
  } else if (isQuoteRequesting) {
    phase = ESwapQuoteUiPhase.Waiting;
    displayQuote = undefined;
  } else if (
    isSwapZeroProviderQuoteCompleted({
      quoteEventTotalCount,
      quoteEventCompleted,
    }) ||
    hasCurrentQuoteFailure
  ) {
    phase = ESwapQuoteUiPhase.ZeroProvider;
    displayQuote = undefined;
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
