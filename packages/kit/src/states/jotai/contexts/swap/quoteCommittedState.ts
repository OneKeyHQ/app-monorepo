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
  preferredProviderKey?: string;
  pendingQuotes: IFetchQuoteResult[];
  settledQuotes: IFetchQuoteResult[];
  displayQuote?: IFetchQuoteResult;
  executableQuote?: IFetchQuoteResult;
  committedAt?: number;
};

type ISwapQuoteCommittedAction =
  | {
      type: 'requestStarted';
      intentFingerprint: string;
      displayIntentFingerprint?: string;
      requestId: string;
      preferredDisplayQuote?: IFetchQuoteResult;
      preferredProviderKey?: string;
    }
  | {
      type: 'candidatesUpdated';
      intentFingerprint: string;
      requestId: string;
      quotes: IFetchQuoteResult[];
      preferredProviderKey: string | undefined;
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

function selectBestActionableQuote(quotes: IFetchQuoteResult[]) {
  return selectBestQuote(quotes.filter(isSwapQuoteActionable));
}

function findActionableQuoteByProvider({
  providerKey,
  quotes,
}: {
  providerKey: string | undefined;
  quotes: IFetchQuoteResult[];
}) {
  if (!providerKey) {
    return undefined;
  }
  return quotes.find(
    (quote) =>
      buildSwapQuoteProviderKey(quote) === providerKey &&
      isSwapQuoteActionable(quote),
  );
}

export function mergeSwapQuoteStreamingEnrichment({
  pinnedQuote,
  latestQuote,
}: {
  pinnedQuote: IFetchQuoteResult;
  latestQuote?: IFetchQuoteResult;
}) {
  if (
    !latestQuote ||
    buildSwapQuoteProviderKey(latestQuote) !==
      buildSwapQuoteProviderKey(pinnedQuote) ||
    latestQuote.autoSuggestedSlippage === undefined ||
    latestQuote.autoSuggestedSlippage === pinnedQuote.autoSuggestedSlippage
  ) {
    return pinnedQuote;
  }
  return {
    ...pinnedQuote,
    autoSuggestedSlippage: latestQuote.autoSuggestedSlippage,
  };
}

/**
 * Keeps a retained quote display-only until the active request returns an
 * actionable candidate. The first accepted provider is then pinned for the
 * main display and Review while later providers continue streaming. Only an
 * explicit manual provider selection or terminal settlement may replace that
 * pin, and neither can mutate a Review snapshot already frozen by the caller.
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
    const preferredProviderKey = isSameDisplayIntent
      ? (action.preferredProviderKey ??
        (preferredDisplayQuote
          ? buildSwapQuoteProviderKey(preferredDisplayQuote)
          : undefined))
      : undefined;

    return {
      phase: ESwapQuoteCommitPhase.Requesting,
      intentFingerprint: action.intentFingerprint,
      displayIntentFingerprint: nextDisplayIntentFingerprint,
      requestId: action.requestId,
      preferredProviderKey,
      pendingQuotes: [],
      settledQuotes: [],
      displayQuote: retainedDisplayQuote,
      committedAt: retainedDisplayQuote ? state.committedAt : undefined,
      // A retained display quote is deliberately stale. Review remains locked
      // until candidatesUpdated publishes a quote from this exact request.
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
    const { preferredProviderKey } = action;
    const latestAcceptedProviderQuote = findActionableQuoteByProvider({
      providerKey: state.executableQuote
        ? buildSwapQuoteProviderKey(state.executableQuote)
        : undefined,
      quotes: action.quotes,
    });
    const preferredQuote = findActionableQuoteByProvider({
      providerKey: preferredProviderKey,
      quotes: action.quotes,
    });
    const executableProviderKey = state.executableQuote
      ? buildSwapQuoteProviderKey(state.executableQuote)
      : undefined;
    let nextExecutableQuote: IFetchQuoteResult | undefined;
    if (preferredProviderKey) {
      nextExecutableQuote =
        state.executableQuote &&
        executableProviderKey === preferredProviderKey &&
        preferredQuote
          ? mergeSwapQuoteStreamingEnrichment({
              pinnedQuote: state.executableQuote,
              latestQuote: preferredQuote,
            })
          : preferredQuote;
    } else if (state.executableQuote && latestAcceptedProviderQuote) {
      nextExecutableQuote = mergeSwapQuoteStreamingEnrichment({
        pinnedQuote: state.executableQuote,
        latestQuote: latestAcceptedProviderQuote,
      });
    } else if (!state.executableQuote) {
      nextExecutableQuote = selectBestActionableQuote(action.quotes);
    }
    const keepsAcceptedProvider = Boolean(
      executableProviderKey &&
      nextExecutableQuote &&
      executableProviderKey === buildSwapQuoteProviderKey(nextExecutableQuote),
    );
    let committedAt = state.committedAt;
    if (nextExecutableQuote && (!keepsAcceptedProvider || !committedAt)) {
      committedAt = Date.now();
    }
    return {
      ...state,
      preferredProviderKey,
      pendingQuotes: [...action.quotes],
      displayQuote: nextExecutableQuote ?? state.displayQuote,
      executableQuote: nextExecutableQuote,
      committedAt,
    };
  }

  if (action.type === 'requestFailed') {
    return {
      ...state,
      phase: ESwapQuoteCommitPhase.Error,
      pendingQuotes: [],
      settledQuotes: [],
      preferredProviderKey: undefined,
      executableQuote: undefined,
    };
  }

  const settledQuotes = action.quotes ?? state.pendingQuotes;
  const selectedQuote = action.selectedQuote;
  // Quote sorting projects cloned rows, so manual intent must be rebound to
  // the guarded candidate from the active request before it becomes executable.
  const selectedProviderKey =
    state.preferredProviderKey ??
    (selectedQuote ? buildSwapQuoteProviderKey(selectedQuote) : undefined);
  const selectedSettledCandidate = findActionableQuoteByProvider({
    providerKey: selectedProviderKey,
    quotes: settledQuotes,
  });
  const selectedSettledQuote =
    selectedSettledCandidate && selectedQuote
      ? mergeSwapQuoteStreamingEnrichment({
          pinnedQuote: selectedSettledCandidate,
          latestQuote: selectedQuote,
        })
      : selectedSettledCandidate;
  const committedSettledQuotes = selectedSettledQuote
    ? settledQuotes.map((quote) =>
        quote === selectedSettledCandidate ? selectedSettledQuote : quote,
      )
    : settledQuotes;
  const committedQuote = state.preferredProviderKey
    ? selectedSettledQuote
    : (selectedSettledQuote ??
      selectBestActionableQuote(committedSettledQuotes));

  return {
    ...state,
    phase: ESwapQuoteCommitPhase.Settled,
    pendingQuotes: [],
    settledQuotes: [...committedSettledQuotes],
    preferredProviderKey: undefined,
    displayQuote: committedQuote,
    executableQuote: committedQuote,
    committedAt: committedQuote ? Date.now() : undefined,
  };
}

export function isSwapQuoteCommittedActiveCandidate(
  state: ISwapQuoteCommittedState,
  quote: IFetchQuoteResult | undefined,
): quote is IFetchQuoteResult {
  if (!quote || !isSwapQuoteActionable(quote)) {
    return false;
  }
  let candidates: IFetchQuoteResult[] = [];
  if (state.phase === ESwapQuoteCommitPhase.Requesting) {
    candidates = state.pendingQuotes;
  } else if (state.phase === ESwapQuoteCommitPhase.Settled) {
    candidates = state.settledQuotes;
  }
  const quoteProviderKey = buildSwapQuoteProviderKey(quote);
  return candidates.some(
    (candidate) =>
      buildSwapQuoteProviderKey(candidate) === quoteProviderKey &&
      isSwapQuoteActionable(candidate),
  );
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
