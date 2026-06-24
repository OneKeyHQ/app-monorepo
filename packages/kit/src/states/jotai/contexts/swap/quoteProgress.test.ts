import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
} from '@onekeyhq/shared/types/swap/types';

import {
  ESwapQuoteUiPhase,
  getSwapQuoteEventProgressTotalCount,
  getSwapQuoteProgressState,
  hasSwapQuoteEventTotalCount,
  hasSwapZeroProviderQuoteEvent,
  isSwapQuoteEventFetching,
  isSwapQuoteFromCurrentEvent,
  isSwapQuoteInputAmountMatched,
  isSwapZeroProviderQuoteCompleted,
  selectSwapPreviousActionableQuote,
} from './quoteProgress';

function buildQuote({
  eventId,
  provider,
  kind = ESwapQuoteKind.SELL,
  toAmount = '10',
}: {
  eventId: string;
  provider: string;
  kind?: ESwapQuoteKind;
  toAmount?: string;
}) {
  return {
    eventId,
    quoteId: `${eventId}-${provider}`,
    kind,
    fromAmount: '1',
    toAmount,
    protocol: EProtocolOfExchange.SWAP,
    info: {
      provider,
      providerName: provider,
    },
  } as IFetchQuoteResult;
}

describe('swap quote progress', () => {
  it('caps quote event total count for scoped provider flows', () => {
    expect(
      getSwapQuoteEventProgressTotalCount({
        quoteEventTotalCount: { eventId: 'event-1', count: 6 },
        maxQuoteCount: 2,
      }),
    ).toEqual({ eventId: 'event-1', count: 2 });
  });

  it('matches quote input amount by quote kind', () => {
    const sellQuote = buildQuote({
      eventId: 'event-1',
      provider: 'sell',
      kind: ESwapQuoteKind.SELL,
    });
    const buyQuote = buildQuote({
      eventId: 'event-1',
      provider: 'buy',
      kind: ESwapQuoteKind.BUY,
      toAmount: '25',
    });

    expect(
      isSwapQuoteInputAmountMatched({
        quote: sellQuote,
        fromAmount: '1',
        toAmount: '99',
      }),
    ).toBe(true);
    expect(
      isSwapQuoteInputAmountMatched({
        quote: sellQuote,
        fromAmount: '2',
        toAmount: '99',
      }),
    ).toBe(false);
    expect(
      isSwapQuoteInputAmountMatched({
        quote: buyQuote,
        fromAmount: '99',
        toAmount: '25',
      }),
    ).toBe(true);
    expect(
      isSwapQuoteInputAmountMatched({
        quote: buyQuote,
        fromAmount: '99',
        toAmount: '26',
      }),
    ).toBe(false);
  });

  it('keeps quote event fetching active until the capped count is received', () => {
    expect(
      isSwapQuoteEventFetching({
        quoteEventTotalCount: { count: 2 },
        currentEventReceivedCount: 1,
        quoteEventCompleted: false,
      }),
    ).toBe(true);

    expect(
      isSwapQuoteEventFetching({
        quoteEventTotalCount: { count: 2 },
        currentEventReceivedCount: 2,
        quoteEventCompleted: false,
      }),
    ).toBe(false);
  });

  it('keeps a zero-provider quote event fetching until the event completes', () => {
    expect(
      isSwapQuoteEventFetching({
        quoteEventTotalCount: { eventId: 'event-1', count: 0 },
        currentEventReceivedCount: 0,
        quoteEventCompleted: false,
      }),
    ).toBe(true);

    expect(
      isSwapQuoteEventFetching({
        quoteEventTotalCount: { eventId: 'event-1', count: 0 },
        currentEventReceivedCount: 0,
        quoteEventCompleted: true,
      }),
    ).toBe(false);
  });

  it('does not treat reset state as a received zero-provider total', () => {
    expect(
      isSwapQuoteEventFetching({
        quoteEventTotalCount: { count: 0 },
        currentEventReceivedCount: 0,
        quoteEventCompleted: false,
      }),
    ).toBe(false);

    expect(
      hasSwapQuoteEventTotalCount({
        quoteEventTotalCount: { count: 0 },
        quoteEventCompleted: false,
      }),
    ).toBe(false);
  });

  it('treats a completed non-event zero-count quote as received', () => {
    expect(
      hasSwapQuoteEventTotalCount({
        quoteEventTotalCount: { count: 0 },
        quoteEventCompleted: true,
      }),
    ).toBe(true);
  });

  it('identifies zero-provider quote events only after receiving an event total', () => {
    expect(
      hasSwapZeroProviderQuoteEvent({
        quoteEventTotalCount: { eventId: 'event-1', count: 0 },
      }),
    ).toBe(true);

    expect(
      hasSwapZeroProviderQuoteEvent({
        quoteEventTotalCount: { count: 0 },
      }),
    ).toBe(false);
  });

  it('marks a zero-provider quote event completed only after the event closes', () => {
    expect(
      isSwapZeroProviderQuoteCompleted({
        quoteEventTotalCount: { eventId: 'event-1', count: 0 },
        quoteEventCompleted: false,
      }),
    ).toBe(false);

    expect(
      isSwapZeroProviderQuoteCompleted({
        quoteEventTotalCount: { eventId: 'event-1', count: 0 },
        quoteEventCompleted: true,
      }),
    ).toBe(true);
  });

  it('treats quotes as previous while a new event has not reported its id', () => {
    const previousQuote = buildQuote({
      eventId: 'event-1',
      provider: 'previous',
    });

    expect(
      isSwapQuoteFromCurrentEvent({
        quote: previousQuote,
        quoteEventTotalCount: { count: 0 },
        quoteLoading: true,
        quoteEventFetching: false,
      }),
    ).toBe(false);

    const state = getSwapQuoteProgressState({
      quoteLoading: true,
      quoteEventFetching: false,
      quoteCurrentSelect: previousQuote,
      quoteEventTotalCount: { count: 0 },
      quoteEventCompleted: false,
    });

    expect(state.phase).toBe(ESwapQuoteUiPhase.StaleRefreshing);
    expect(state.displayQuote).toBe(previousQuote);
    expect(state.isWaitingActionableQuote).toBe(true);
    expect(state.isInputQuoteLoading).toBe(false);
  });

  it('loads the input only while waiting without a previous quote', () => {
    const state = getSwapQuoteProgressState({
      quoteLoading: true,
      quoteEventFetching: false,
      quoteEventTotalCount: { count: 0 },
      quoteEventCompleted: false,
    });

    expect(state.phase).toBe(ESwapQuoteUiPhase.Waiting);
    expect(state.displayQuote).toBeUndefined();
    expect(state.isWaitingActionableQuote).toBe(true);
    expect(state.isInputQuoteLoading).toBe(true);
  });

  it('keeps a previous actionable quote while the current event is still waiting', () => {
    const previousQuote = buildQuote({
      eventId: 'event-1',
      provider: 'previous',
    });

    const selectedPreviousQuote = selectSwapPreviousActionableQuote({
      quotes: [previousQuote],
      quoteEventTotalCount: { eventId: 'event-2', count: 2 },
      quoteLoading: false,
      quoteEventFetching: true,
    });

    const state = getSwapQuoteProgressState({
      quoteLoading: false,
      quoteEventFetching: true,
      previousQuote: selectedPreviousQuote,
      quoteEventTotalCount: { eventId: 'event-2', count: 2 },
      quoteEventCompleted: false,
    });

    expect(state.phase).toBe(ESwapQuoteUiPhase.StaleRefreshing);
    expect(state.displayQuote).toBe(previousQuote);
    expect(state.hasPreviousActionableQuote).toBe(true);
  });

  it('moves to hasQuote when the current event quote arrives', () => {
    const currentQuote = buildQuote({
      eventId: 'event-2',
      provider: 'current',
    });

    const state = getSwapQuoteProgressState({
      quoteLoading: false,
      quoteEventFetching: true,
      quoteCurrentSelect: currentQuote,
      quoteEventTotalCount: { eventId: 'event-2', count: 2 },
      quoteEventCompleted: false,
    });

    expect(state.phase).toBe(ESwapQuoteUiPhase.HasQuote);
    expect(state.displayQuote).toBe(currentQuote);
    expect(state.isWaitingActionableQuote).toBe(false);
  });

  it('only shows zero-provider after the current event terminally has no quote', () => {
    const previousQuote = buildQuote({
      eventId: 'event-1',
      provider: 'previous',
    });

    const state = getSwapQuoteProgressState({
      quoteLoading: false,
      quoteEventFetching: false,
      quoteCurrentSelect: previousQuote,
      quoteEventTotalCount: { eventId: 'event-2', count: 0 },
      quoteEventCompleted: true,
    });

    expect(state.phase).toBe(ESwapQuoteUiPhase.ZeroProvider);
    expect(state.displayQuote).toBeUndefined();
    expect(state.isWaitingActionableQuote).toBe(false);
  });

  it('uses error phase before falling back to stale quotes', () => {
    const previousQuote = buildQuote({
      eventId: 'event-1',
      provider: 'previous',
    });

    const state = getSwapQuoteProgressState({
      quoteLoading: false,
      quoteEventFetching: false,
      previousQuote,
      quoteEventTotalCount: { eventId: 'event-2', count: 1 },
      quoteEventCompleted: true,
      quoteEventError: { message: 'market closed' },
    });

    expect(state.phase).toBe(ESwapQuoteUiPhase.Error);
    expect(state.displayQuote).toBeUndefined();
  });
});
