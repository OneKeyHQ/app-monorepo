import { selectBestQuote } from '@onekeyhq/shared/src/utils/swapQuoteSortUtils';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapQuoteProviderKey,
  isSwapQuoteActionable,
} from './quoteProgress';

export enum ESwapQuoteCommitPhase {
  Idle = 'idle',
  Requesting = 'requesting',
  Settled = 'settled',
  Error = 'error',
}

export type ISwapQuoteCommittedState = {
  phase: ESwapQuoteCommitPhase;
  intentFingerprint?: string;
  displayIntentFingerprint?: string;
  requestId?: string;
  pendingQuotes: IFetchQuoteResult[];
  settledQuotes: IFetchQuoteResult[];
  displayQuote?: IFetchQuoteResult;
  executableQuote?: IFetchQuoteResult;
  committedAt?: number;
};

export type ISwapQuoteCommittedAction =
  | {
      type: 'requestStarted';
      intentFingerprint: string;
      displayIntentFingerprint?: string;
      requestId: string;
      preferredDisplayQuote?: IFetchQuoteResult;
    }
  | {
      type: 'candidatesUpdated';
      intentFingerprint: string;
      requestId: string;
      quotes: IFetchQuoteResult[];
    }
  | {
      type: 'requestSettled';
      intentFingerprint: string;
      requestId: string;
      quotes?: IFetchQuoteResult[];
      selectedQuote?: IFetchQuoteResult;
    }
  | {
      type: 'requestFailed';
      intentFingerprint: string;
      requestId: string;
    }
  | { type: 'reset' };

export const initialSwapQuoteCommittedState: ISwapQuoteCommittedState = {
  phase: ESwapQuoteCommitPhase.Idle,
  pendingQuotes: [],
  settledQuotes: [],
};

function isCurrentSwapQuoteRequest({
  state,
  intentFingerprint,
  requestId,
}: {
  state: ISwapQuoteCommittedState;
  intentFingerprint: string;
  requestId: string;
}) {
  return (
    state.intentFingerprint === intentFingerprint &&
    state.requestId === requestId
  );
}

function selectBestSettledQuote(quotes: IFetchQuoteResult[]) {
  return selectBestQuote(quotes.filter(isSwapQuoteActionable));
}

/**
 * Keeps streaming provider candidates separate from the quote shown on the
 * main card. A request may update candidates many times, but it can publish a
 * new display/execution quote only after that request settles.
 */
export function reduceSwapQuoteCommittedState(
  state: ISwapQuoteCommittedState,
  action: ISwapQuoteCommittedAction,
): ISwapQuoteCommittedState {
  if (action.type === 'reset') {
    return initialSwapQuoteCommittedState;
  }

  if (action.type === 'requestStarted') {
    const nextDisplayIntentFingerprint =
      action.displayIntentFingerprint ?? action.intentFingerprint;
    const previousDisplayIntentFingerprint =
      state.displayIntentFingerprint ?? state.intentFingerprint;
    const isSameDisplayIntent =
      previousDisplayIntentFingerprint === nextDisplayIntentFingerprint;
    const preferredDisplayQuote =
      isSameDisplayIntent &&
      state.phase === ESwapQuoteCommitPhase.Settled &&
      action.preferredDisplayQuote &&
      state.settledQuotes.includes(action.preferredDisplayQuote) &&
      isSwapQuoteActionable(action.preferredDisplayQuote)
        ? action.preferredDisplayQuote
        : undefined;
    const retainedDisplayQuote = isSameDisplayIntent
      ? (preferredDisplayQuote ?? state.displayQuote)
      : undefined;

    return {
      phase: ESwapQuoteCommitPhase.Requesting,
      intentFingerprint: action.intentFingerprint,
      displayIntentFingerprint: nextDisplayIntentFingerprint,
      requestId: action.requestId,
      pendingQuotes: [],
      settledQuotes: [],
      displayQuote: retainedDisplayQuote,
      committedAt: retainedDisplayQuote ? state.committedAt : undefined,
      // A retained display quote is deliberately stale and must never be used
      // for Review/build while the replacement request is in flight.
      executableQuote: undefined,
    };
  }

  if (
    !isCurrentSwapQuoteRequest({
      state,
      intentFingerprint: action.intentFingerprint,
      requestId: action.requestId,
    })
  ) {
    return state;
  }

  if (action.type === 'candidatesUpdated') {
    return {
      ...state,
      pendingQuotes: [...action.quotes],
    };
  }

  if (action.type === 'requestFailed') {
    return {
      ...state,
      phase: ESwapQuoteCommitPhase.Error,
      pendingQuotes: [],
      settledQuotes: [],
      executableQuote: undefined,
    };
  }

  const settledQuotes = action.quotes ?? state.pendingQuotes;
  const selectedQuote = action.selectedQuote;
  // Quote sorting projects cloned rows, so manual intent must be rebound to
  // the guarded candidate from the active request before it becomes executable.
  const selectedSettledQuote = selectedQuote
    ? settledQuotes.find(
        (quote) =>
          buildSwapQuoteProviderKey(quote) ===
          buildSwapQuoteProviderKey(selectedQuote),
      )
    : undefined;
  const committedQuote =
    selectedSettledQuote && isSwapQuoteActionable(selectedSettledQuote)
      ? selectedSettledQuote
      : selectBestSettledQuote(settledQuotes);

  return {
    ...state,
    phase: ESwapQuoteCommitPhase.Settled,
    pendingQuotes: [],
    settledQuotes: [...settledQuotes],
    displayQuote: committedQuote,
    executableQuote: committedQuote,
    committedAt: Date.now(),
  };
}

export function isSwapQuoteCommittedSettledCandidate(
  state: ISwapQuoteCommittedState,
  quote: IFetchQuoteResult | undefined,
): quote is IFetchQuoteResult {
  return Boolean(
    state.phase === ESwapQuoteCommitPhase.Settled &&
    quote &&
    state.settledQuotes.includes(quote) &&
    isSwapQuoteActionable(quote),
  );
}

export function selectSwapQuoteCommittedSnapshot(
  state: ISwapQuoteCommittedState,
) {
  return {
    displayQuote: state.displayQuote,
    executableQuote: state.executableQuote,
    isRequesting: state.phase === ESwapQuoteCommitPhase.Requesting,
    canExecute: isSwapQuoteCommittedSettledCandidate(
      state,
      state.executableQuote,
    ),
  };
}

export function hasSwapQuoteSelectableProviderCandidate(
  state: ISwapQuoteCommittedState,
) {
  // Picker readiness is intentionally independent from settled display and
  // execution readiness so the first usable SSE candidate can be selected.
  return (
    state.phase === ESwapQuoteCommitPhase.Requesting &&
    state.pendingQuotes.some(isSwapQuoteActionable)
  );
}
