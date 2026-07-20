import BigNumber from 'bignumber.js';

import { selectBestQuote } from '@onekeyhq/shared/src/utils/swapQuoteSortUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapQuoteKind,
  ESwapTabSwitchType,
  type IFetchQuoteResult,
  type ISwapToken,
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
  isQuotePresentationLoading: boolean;
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
  currentEventProviderKeys: string[];
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
  quoteResultPairNoMatch,
}: {
  zeroProviderQuoteCompleted: boolean;
  quote?: Pick<IFetchQuoteResult, 'toAmount' | 'limit'>;
  quoteResultPairNoMatch: boolean;
}) {
  // Only trust the no-provider verdict when the quote belongs to the current
  // token pair; a stale quote left over from a previous pair must not lock
  // the action button out of its "Refresh quotes" recovery state. The veto
  // must stay identity-based: provider-error quotes carry no amount fields
  // at all, so an amount-based mismatch check would permanently veto the
  // genuine no-provider signal. (OK-57545)
  return (
    (zeroProviderQuoteCompleted ||
      Boolean(quote && !quote.toAmount && !quote.limit)) &&
    !quoteResultPairNoMatch
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

export function resolveSwapQuoteForDisplay({
  quoteResult,
  displayQuote,
  phase,
}: {
  quoteResult?: IFetchQuoteResult;
  displayQuote?: IFetchQuoteResult;
  phase: ESwapQuoteUiPhase;
}) {
  if (
    phase === ESwapQuoteUiPhase.StaleRefreshing &&
    isSwapQuoteActionable(displayQuote)
  ) {
    return displayQuote;
  }

  return quoteResult ?? displayQuote;
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

export function shouldOfferSwapQuoteRefresh({
  isRefreshQuote,
  quoteResultNoMatch,
  quoteResultNoMatchDebounced,
  quoteLoading,
  quoteEventFetching,
}: {
  isRefreshQuote: boolean;
  quoteResultNoMatch: boolean;
  quoteResultNoMatchDebounced: boolean;
  quoteLoading: boolean;
  quoteEventFetching: boolean;
}) {
  return (
    !quoteLoading &&
    !quoteEventFetching &&
    (isRefreshQuote || (quoteResultNoMatch && quoteResultNoMatchDebounced))
  );
}

export function shouldShowSwapQuoteActionLoading({
  isWaitingActionableQuote,
  isQuoteEventSettlingForAction,
  isWaitingAutoSlippage,
}: {
  isWaitingActionableQuote: boolean;
  isQuoteEventSettlingForAction: boolean;
  isWaitingAutoSlippage: boolean;
}) {
  return (
    isWaitingActionableQuote ||
    isQuoteEventSettlingForAction ||
    isWaitingAutoSlippage
  );
}

export function isSameSwapQuoteAmountValue({
  currentAmount,
  requestAmount,
}: {
  currentAmount?: string;
  requestAmount?: string;
}) {
  if (requestAmount === undefined) {
    return true;
  }
  const normalizedCurrentAmount = currentAmount ?? '';
  if (!requestAmount && !normalizedCurrentAmount) {
    return true;
  }
  const requestAmountBN = new BigNumber(requestAmount);
  const currentAmountBN = new BigNumber(normalizedCurrentAmount);
  if (
    requestAmountBN.isFinite() &&
    !requestAmountBN.isNaN() &&
    currentAmountBN.isFinite() &&
    !currentAmountBN.isNaN()
  ) {
    return requestAmountBN.eq(currentAmountBN);
  }
  return requestAmount === normalizedCurrentAmount;
}

export function isSwapQuoteRequestForCurrentInput({
  currentSwapType,
  fromAmount,
  fromToken,
  quoteKind,
  quoteRequest,
  toAmount,
  toToken,
}: {
  currentSwapType: ESwapTabSwitchType;
  fromAmount: string;
  fromToken?: ISwapToken;
  quoteKind: ESwapQuoteKind;
  quoteRequest?: {
    type?: ESwapTabSwitchType;
    fromToken?: ISwapToken;
    toToken?: ISwapToken;
    fromTokenAmount?: string;
    toTokenAmount?: string;
    kind?: ESwapQuoteKind;
  };
  toAmount: string;
  toToken?: ISwapToken;
}) {
  if (
    quoteRequest?.type !== currentSwapType ||
    (quoteRequest.kind ?? ESwapQuoteKind.SELL) !== quoteKind ||
    !equalTokenNoCaseSensitive({
      token1: quoteRequest.fromToken,
      token2: fromToken,
    }) ||
    !equalTokenNoCaseSensitive({
      token1: quoteRequest.toToken,
      token2: toToken,
    })
  ) {
    return false;
  }

  const requestAmount =
    quoteKind === ESwapQuoteKind.BUY
      ? quoteRequest.toTokenAmount
      : quoteRequest.fromTokenAmount;
  if (requestAmount === undefined) {
    return false;
  }
  return isSameSwapQuoteAmountValue({
    currentAmount: quoteKind === ESwapQuoteKind.BUY ? toAmount : fromAmount,
    requestAmount,
  });
}

export function isSwapOrBridgeQuoteType(swapType: ESwapTabSwitchType) {
  return (
    swapType === ESwapTabSwitchType.SWAP ||
    swapType === ESwapTabSwitchType.BRIDGE
  );
}

export function shouldShowSwapQuoteRequestLoading({
  swapType,
  hasCurrentActionableQuote,
  hasValidInput,
  isQuoteRequestStarting,
  quoteEventCompleted,
  quoteRequestMatchesInput,
}: {
  swapType: ESwapTabSwitchType;
  hasCurrentActionableQuote: boolean;
  hasValidInput: boolean;
  isQuoteRequestStarting: boolean;
  quoteEventCompleted: boolean;
  quoteRequestMatchesInput: boolean;
}) {
  if (!isSwapOrBridgeQuoteType(swapType) || !hasValidInput) {
    return false;
  }
  if (isQuoteRequestStarting) {
    return true;
  }
  if (hasCurrentActionableQuote) {
    return false;
  }
  return !(quoteRequestMatchesInput && quoteEventCompleted);
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
  currentEventProviderKeys,
  quoteLoading,
  quoteEventFetching,
}: ISwapPreviousQuoteInput) {
  const isQuoteRequesting = quoteLoading || quoteEventFetching;
  const previousQuotes = quotes.filter((quote) => {
    if (!isSwapQuoteActionable(quote)) {
      return false;
    }

    const isCurrentEventQuote = isSwapQuoteFromCurrentEvent({
      quote,
      quoteEventTotalCount,
      quoteLoading,
      quoteEventFetching,
    });
    if (!isCurrentEventQuote) {
      return true;
    }

    // Re-quote keeps compatible provider results by assigning the new event
    // id. Until that provider responds, the retained result remains display-only
    // and must not disappear when another provider returns first.
    return (
      isQuoteRequesting &&
      Boolean(quoteEventTotalCount.eventId) &&
      !hasSwapCurrentEventProvider(quote, currentEventProviderKeys)
    );
  });

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
    isQuotePresentationLoading: phase === ESwapQuoteUiPhase.Waiting,
    phase,
    displayQuote,
    previousQuote: displayPreviousQuote,
  };
}
