import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import {
  ESwapQuoteCommitPhase,
  hasSwapQuoteSelectableProviderCandidate,
  initialSwapQuoteCommittedState,
  isSwapQuoteCommittedActiveCandidate,
  isSwapQuoteCommittedSettledCandidate,
  reduceSwapQuoteCommittedState,
  selectSwapQuoteCommittedSnapshot,
} from './quoteCommittedState';

function buildQuote(provider: string, toAmount: string): IFetchQuoteResult {
  return {
    quoteId: `quote-${provider}`,
    eventId: 'event-1',
    protocol: EProtocolOfExchange.SWAP,
    fromAmount: '1',
    toAmount,
    fromTokenInfo: {
      networkId: 'evm--1',
      contractAddress: '0xfrom',
      symbol: 'FROM',
      decimals: 18,
    },
    toTokenInfo: {
      networkId: 'evm--1',
      contractAddress: '0xto',
      symbol: 'TO',
      decimals: 18,
    },
    info: {
      provider,
      providerName: provider,
    },
  };
}

describe('swap quote committed state', () => {
  it('publishes and pins the first actionable candidate while later providers stream', () => {
    const previousQuote = buildQuote('previous', '10');
    const firstCandidate = buildQuote('first', '11');
    const bestCandidate = buildQuote('best', '12');

    let state = reduceSwapQuoteCommittedState(initialSwapQuoteCommittedState, {
      type: 'requestStarted',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestSettled',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
      quotes: [previousQuote],
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestStarted',
      intentFingerprint: 'intent-1',
      requestId: 'request-2',
    });
    expect(hasSwapQuoteSelectableProviderCandidate(state)).toBe(false);

    expect(selectSwapQuoteCommittedSnapshot(state)).toEqual({
      displayQuote: previousQuote,
      executableQuote: undefined,
      isRequesting: true,
      canExecute: false,
    });

    state = reduceSwapQuoteCommittedState(state, {
      type: 'candidatesUpdated',
      intentFingerprint: 'intent-1',
      requestId: 'request-2',
      quotes: [firstCandidate],
    });
    expect(state.displayQuote).toBe(firstCandidate);
    expect(state.executableQuote).toBe(firstCandidate);
    expect(state.committedAt).toEqual(expect.any(Number));
    expect(selectSwapQuoteCommittedSnapshot(state).canExecute).toBe(true);
    expect(isSwapQuoteCommittedActiveCandidate(state, firstCandidate)).toBe(
      true,
    );
    expect(hasSwapQuoteSelectableProviderCandidate(state)).toBe(true);

    state = reduceSwapQuoteCommittedState(state, {
      type: 'candidatesUpdated',
      intentFingerprint: 'intent-1',
      requestId: 'request-2',
      quotes: [bestCandidate, firstCandidate],
    });
    expect(state.displayQuote).toBe(firstCandidate);
    expect(state.executableQuote).toBe(firstCandidate);

    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestSettled',
      intentFingerprint: 'intent-1',
      requestId: 'request-2',
    });
    expect(state.displayQuote).toBe(bestCandidate);
    expect(state.executableQuote).toBe(bestCandidate);
    expect(state.settledQuotes).toEqual([bestCandidate, firstCandidate]);
    expect(state.phase).toBe(ESwapQuoteCommitPhase.Settled);
    expect(hasSwapQuoteSelectableProviderCandidate(state)).toBe(false);
  });

  it('pins economic fields when the accepted provider streams an updated quote', () => {
    const firstCandidate = buildQuote('same-provider', '10');
    const laterCandidate = {
      ...firstCandidate,
      quoteId: 'quote-same-provider-later',
      toAmount: '9.7',
    };
    let state = reduceSwapQuoteCommittedState(initialSwapQuoteCommittedState, {
      type: 'requestStarted',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'candidatesUpdated',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
      quotes: [firstCandidate],
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'candidatesUpdated',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
      quotes: [laterCandidate],
    });

    expect(state.displayQuote).toBe(firstCandidate);
    expect(state.executableQuote).toBe(firstCandidate);
    expect(state.executableQuote?.toAmount).toBe('10');
    expect(state.pendingQuotes).toEqual([laterCandidate]);

    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestSettled',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
      selectedQuote: laterCandidate,
    });

    expect(state.displayQuote).toBe(laterCandidate);
    expect(state.executableQuote?.toAmount).toBe('9.7');
  });

  it('retains every settled candidate and accepts a selected candidate for execution', () => {
    const bestCandidate = buildQuote('best', '12');
    const manualCandidate = buildQuote('manual', '11');
    let state = reduceSwapQuoteCommittedState(initialSwapQuoteCommittedState, {
      type: 'requestStarted',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'candidatesUpdated',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
      quotes: [bestCandidate, manualCandidate],
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestSettled',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
      selectedQuote: {
        ...manualCandidate,
        isBest: false,
        minGasCost: false,
        receivedBest: false,
      },
    });

    expect(state.executableQuote).toBe(manualCandidate);
    expect(state.settledQuotes).toEqual([bestCandidate, manualCandidate]);
    expect(isSwapQuoteCommittedSettledCandidate(state, bestCandidate)).toBe(
      true,
    );
    expect(isSwapQuoteCommittedSettledCandidate(state, manualCandidate)).toBe(
      true,
    );

    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestStarted',
      intentFingerprint: 'intent-1',
      requestId: 'request-2',
    });
    expect(state.settledQuotes).toEqual([]);
    expect(isSwapQuoteCommittedSettledCandidate(state, manualCandidate)).toBe(
      false,
    );
  });

  it('keeps the latest AUTO slippage enrichment when the request settles', () => {
    const candidate = buildQuote('auto-provider', '12');
    let state = reduceSwapQuoteCommittedState(initialSwapQuoteCommittedState, {
      type: 'requestStarted',
      intentFingerprint: 'intent-auto',
      requestId: 'request-auto',
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'candidatesUpdated',
      intentFingerprint: 'intent-auto',
      requestId: 'request-auto',
      quotes: [candidate],
    });

    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestSettled',
      intentFingerprint: 'intent-auto',
      requestId: 'request-auto',
      selectedQuote: {
        ...candidate,
        autoSuggestedSlippage: 1.2,
      },
    });

    expect(state.executableQuote?.autoSuggestedSlippage).toBe(1.2);
    expect(state.settledQuotes[0]?.autoSuggestedSlippage).toBe(1.2);
    expect(
      isSwapQuoteCommittedSettledCandidate(state, state.executableQuote),
    ).toBe(true);
  });

  it('falls back immediately, then pins the preferred provider when it returns', () => {
    const bestCandidate = buildQuote('best', '12');
    const manualCandidate = buildQuote('manual', '11');
    const refreshedBestCandidate = {
      ...buildQuote('best', '12.1'),
      eventId: 'event-2',
    };
    const refreshedManualCandidate = {
      ...buildQuote('manual', '11.1'),
      eventId: 'event-2',
    };
    const laterManualCandidate = {
      ...refreshedManualCandidate,
      quoteId: 'quote-manual-later',
      toAmount: '10.9',
    };
    let state = reduceSwapQuoteCommittedState(initialSwapQuoteCommittedState, {
      type: 'requestStarted',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestSettled',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
      quotes: [bestCandidate, manualCandidate],
    });

    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestStarted',
      intentFingerprint: 'intent-1',
      requestId: 'request-2',
      preferredDisplayQuote: manualCandidate,
    });
    expect(state.displayQuote).toBe(manualCandidate);
    expect(state.executableQuote).toBeUndefined();
    expect(state.settledQuotes).toEqual([]);

    state = reduceSwapQuoteCommittedState(state, {
      type: 'candidatesUpdated',
      intentFingerprint: 'intent-1',
      requestId: 'request-2',
      quotes: [refreshedBestCandidate],
    });
    expect(state.displayQuote).toBe(refreshedBestCandidate);
    expect(state.executableQuote).toBe(refreshedBestCandidate);
    expect(selectSwapQuoteCommittedSnapshot(state).canExecute).toBe(true);
    const fallbackCommittedAt = state.committedAt ?? 0;
    const preferredCommittedAt = fallbackCommittedAt + 1000;
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(preferredCommittedAt);

    state = reduceSwapQuoteCommittedState(state, {
      type: 'candidatesUpdated',
      intentFingerprint: 'intent-1',
      requestId: 'request-2',
      quotes: [refreshedBestCandidate, refreshedManualCandidate],
    });
    dateNowSpy.mockRestore();
    expect(state.displayQuote).toBe(refreshedManualCandidate);
    expect(state.executableQuote).toBe(refreshedManualCandidate);
    expect(state.committedAt).toBe(preferredCommittedAt);
    expect(selectSwapQuoteCommittedSnapshot(state).canExecute).toBe(true);

    state = reduceSwapQuoteCommittedState(state, {
      type: 'candidatesUpdated',
      intentFingerprint: 'intent-1',
      requestId: 'request-2',
      quotes: [refreshedBestCandidate, laterManualCandidate],
    });
    expect(state.displayQuote).toBe(refreshedManualCandidate);
    expect(state.executableQuote).toBe(refreshedManualCandidate);
    expect(state.committedAt).toBe(preferredCommittedAt);

    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestSettled',
      intentFingerprint: 'intent-1',
      requestId: 'request-2',
      selectedQuote: laterManualCandidate,
    });
    expect(state.displayQuote).toBe(laterManualCandidate);
    expect(state.executableQuote).toBe(laterManualCandidate);
  });

  it('does not retain a preferred display from a different intent', () => {
    const previousQuote = buildQuote('previous', '10');
    let state = reduceSwapQuoteCommittedState(initialSwapQuoteCommittedState, {
      type: 'requestStarted',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestSettled',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
      quotes: [previousQuote],
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestStarted',
      intentFingerprint: 'intent-2',
      requestId: 'request-2',
      preferredDisplayQuote: previousQuote,
    });

    expect(state.displayQuote).toBeUndefined();
    expect(state.executableQuote).toBeUndefined();
  });

  it('retains display across an AUTO refresh with a new execution fingerprint but the same display intent', () => {
    const previousQuote = buildQuote('previous', '10');
    let state = reduceSwapQuoteCommittedState(initialSwapQuoteCommittedState, {
      type: 'requestStarted',
      intentFingerprint: 'execution-auto-0.5',
      displayIntentFingerprint: 'display-auto',
      requestId: 'request-1',
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestSettled',
      intentFingerprint: 'execution-auto-0.5',
      requestId: 'request-1',
      quotes: [previousQuote],
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestStarted',
      intentFingerprint: 'execution-auto-1.2',
      displayIntentFingerprint: 'display-auto',
      requestId: 'request-2',
    });

    expect(state.phase).toBe(ESwapQuoteCommitPhase.Requesting);
    expect(state.displayQuote).toBe(previousQuote);
    expect(state.executableQuote).toBeUndefined();
    expect(state.settledQuotes).toEqual([]);
  });

  it('clears once when the intent fingerprint changes and ignores stale events', () => {
    const oldQuote = buildQuote('old', '10');
    const staleQuote = buildQuote('stale', '99');
    let state = reduceSwapQuoteCommittedState(initialSwapQuoteCommittedState, {
      type: 'requestStarted',
      intentFingerprint: 'intent-old',
      requestId: 'request-old',
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestSettled',
      intentFingerprint: 'intent-old',
      requestId: 'request-old',
      quotes: [oldQuote],
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestStarted',
      intentFingerprint: 'intent-new',
      requestId: 'request-new',
    });

    expect(state.displayQuote).toBeUndefined();
    expect(state.executableQuote).toBeUndefined();

    const afterStaleCandidate = reduceSwapQuoteCommittedState(state, {
      type: 'candidatesUpdated',
      intentFingerprint: 'intent-old',
      requestId: 'request-old',
      quotes: [staleQuote],
    });
    expect(afterStaleCandidate).toBe(state);
    expect(afterStaleCandidate.displayQuote).toBeUndefined();

    const afterStaleSettle = reduceSwapQuoteCommittedState(
      afterStaleCandidate,
      {
        type: 'requestSettled',
        intentFingerprint: 'intent-old',
        requestId: 'request-old',
        quotes: [staleQuote],
      },
    );
    expect(afterStaleSettle).toBe(afterStaleCandidate);
  });

  it('commits only actionable quotes and keeps failed refreshes non-executable', () => {
    const previousQuote = buildQuote('previous', '10');
    const errorQuote = buildQuote('error', '0');
    let state = reduceSwapQuoteCommittedState(initialSwapQuoteCommittedState, {
      type: 'requestStarted',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestSettled',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
      quotes: [previousQuote],
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestStarted',
      intentFingerprint: 'intent-1',
      requestId: 'request-2',
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'candidatesUpdated',
      intentFingerprint: 'intent-1',
      requestId: 'request-2',
      quotes: [errorQuote],
    });
    expect(hasSwapQuoteSelectableProviderCandidate(state)).toBe(false);
    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestFailed',
      intentFingerprint: 'intent-1',
      requestId: 'request-2',
    });

    expect(state.phase).toBe(ESwapQuoteCommitPhase.Error);
    expect(state.displayQuote).toBe(previousQuote);
    expect(selectSwapQuoteCommittedSnapshot(state).canExecute).toBe(false);
  });

  it('rejects positive-output quotes with limit or error semantics', () => {
    const belowMinimum = {
      ...buildQuote('below-minimum', '10'),
      limit: { min: '2' },
    };
    const providerError = {
      ...buildQuote('provider-error', '10'),
      errorMessage: 'provider unavailable',
    };
    let state = reduceSwapQuoteCommittedState(initialSwapQuoteCommittedState, {
      type: 'requestStarted',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
    });
    state = reduceSwapQuoteCommittedState(state, {
      type: 'candidatesUpdated',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
      quotes: [belowMinimum, providerError],
    });

    expect(hasSwapQuoteSelectableProviderCandidate(state)).toBe(false);
    expect(state.displayQuote).toBeUndefined();
    expect(state.executableQuote).toBeUndefined();
    expect(selectSwapQuoteCommittedSnapshot(state).canExecute).toBe(false);

    state = reduceSwapQuoteCommittedState(state, {
      type: 'requestSettled',
      intentFingerprint: 'intent-1',
      requestId: 'request-1',
    });
    expect(state.executableQuote).toBeUndefined();
  });
});
