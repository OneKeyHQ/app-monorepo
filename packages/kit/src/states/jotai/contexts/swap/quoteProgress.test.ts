import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  ESwapQuoteRefreshAction,
  ESwapQuoteUiPhase,
  buildSwapQuoteProviderKey,
  getSwapQuoteEventProgressTotalCount,
  getSwapQuoteProgressState,
  hasSwapQuoteEventTotalCount,
  hasSwapZeroProviderQuoteEvent,
  isSwapNoProviderSupportsTrade,
  isSwapQuoteEventFetching,
  isSwapQuoteFromCurrentEvent,
  isSwapQuoteInputAmountMatched,
  isSwapQuoteRequestForCurrentInput,
  isSwapZeroProviderQuoteCompleted,
  resolveSwapQuoteForDisplay,
  resolveSwapQuoteRefreshAction,
  selectSwapCurrentQuote,
  selectSwapPreviousActionableQuote,
  shouldOfferSwapQuoteRefresh,
  shouldShowSwapQuoteActionLoading,
  shouldShowSwapQuoteRequestLoading,
} from './quoteProgress';

function buildQuote({
  eventId,
  provider,
  kind = ESwapQuoteKind.SELL,
  toAmount = '10',
  errorMessage,
}: {
  eventId: string;
  provider: string;
  kind?: ESwapQuoteKind;
  toAmount?: string;
  errorMessage?: string;
}) {
  return {
    eventId,
    quoteId: `${eventId}-${provider}`,
    kind,
    fromAmount: '1',
    toAmount,
    errorMessage,
    protocol: EProtocolOfExchange.SWAP,
    info: {
      provider,
      providerName: provider,
    },
  } as IFetchQuoteResult;
}

describe('swap quote progress', () => {
  it('allows exactly five automatic refresh requests before requiring manual refresh', () => {
    expect(
      resolveSwapQuoteRefreshAction({
        automaticRefreshCount: 4,
        maxAutomaticRefreshCount: 5,
      }),
    ).toEqual({
      action: ESwapQuoteRefreshAction.AutoRequest,
      nextAutomaticRefreshCount: 5,
    });
    expect(
      resolveSwapQuoteRefreshAction({
        automaticRefreshCount: 5,
        maxAutomaticRefreshCount: 5,
      }),
    ).toEqual({
      action: ESwapQuoteRefreshAction.RequireManualRefresh,
      nextAutomaticRefreshCount: 5,
    });
  });

  it('matches the quote request to the current Swap input scope', () => {
    const fromToken = {
      networkId: 'evm--56',
      contractAddress: '0xfrom',
      decimals: 6,
      isNative: false,
      symbol: 'FROM',
    };
    const toToken = {
      networkId: 'evm--56',
      contractAddress: '0xto',
      decimals: 6,
      isNative: false,
      symbol: 'TO',
    };
    const quoteRequest = {
      type: ESwapTabSwitchType.SWAP,
      fromToken,
      toToken,
      fromTokenAmount: '1.0',
      kind: ESwapQuoteKind.SELL,
      accountId: 'account-1',
      address: '0xsender-1',
      receivingAddress: '0xreceiver-1',
    };

    expect(
      isSwapQuoteRequestForCurrentInput({
        currentAccountId: 'account-1',
        currentAddress: '0xsender-1',
        currentReceivingAddress: '0xreceiver-1',
        currentSwapType: ESwapTabSwitchType.SWAP,
        fromAmount: '1',
        fromToken,
        quoteKind: ESwapQuoteKind.SELL,
        quoteRequest,
        toAmount: '',
        toToken,
      }),
    ).toBe(true);
    expect(
      isSwapQuoteRequestForCurrentInput({
        currentAccountId: 'account-1',
        currentAddress: '0xsender-1',
        currentReceivingAddress: '0xreceiver-1',
        currentSwapType: ESwapTabSwitchType.SWAP,
        fromAmount: '10',
        fromToken,
        quoteKind: ESwapQuoteKind.SELL,
        quoteRequest,
        toAmount: '',
        toToken,
      }),
    ).toBe(false);
    [
      {
        currentAccountId: 'account-2',
        currentAddress: '0xsender-1',
        currentReceivingAddress: '0xreceiver-1',
      },
      {
        currentAccountId: 'account-1',
        currentAddress: '0xsender-2',
        currentReceivingAddress: '0xreceiver-1',
      },
      {
        currentAccountId: 'account-1',
        currentAddress: '0xsender-1',
        currentReceivingAddress: '0xreceiver-2',
      },
    ].forEach((currentExecutionScope) => {
      expect(
        isSwapQuoteRequestForCurrentInput({
          ...currentExecutionScope,
          currentSwapType: ESwapTabSwitchType.SWAP,
          fromAmount: '1',
          fromToken,
          quoteKind: ESwapQuoteKind.SELL,
          quoteRequest,
          toAmount: '',
          toToken,
        }),
      ).toBe(false);
    });
  });

  it('keeps a new input round loading until its current quote is actionable', () => {
    expect(
      shouldShowSwapQuoteRequestLoading({
        swapType: ESwapTabSwitchType.SWAP,
        hasCurrentActionableQuote: false,
        hasValidInput: true,
        isQuoteRequestStarting: false,
        quoteEventCompleted: true,
        quoteRequestMatchesInput: false,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapQuoteRequestLoading({
        swapType: ESwapTabSwitchType.SWAP,
        hasCurrentActionableQuote: false,
        hasValidInput: true,
        isQuoteRequestStarting: true,
        quoteEventCompleted: false,
        quoteRequestMatchesInput: true,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapQuoteRequestLoading({
        swapType: ESwapTabSwitchType.SWAP,
        hasCurrentActionableQuote: true,
        hasValidInput: true,
        isQuoteRequestStarting: false,
        quoteEventCompleted: false,
        quoteRequestMatchesInput: true,
      }),
    ).toBe(false);
    expect(
      shouldShowSwapQuoteRequestLoading({
        swapType: ESwapTabSwitchType.SWAP,
        hasCurrentActionableQuote: true,
        hasValidInput: true,
        isQuoteRequestStarting: false,
        quoteEventCompleted: true,
        quoteRequestMatchesInput: false,
      }),
    ).toBe(true);
  });

  it('leaves current terminal and empty-input states out of quote loading', () => {
    expect(
      shouldShowSwapQuoteRequestLoading({
        swapType: ESwapTabSwitchType.SWAP,
        hasCurrentActionableQuote: false,
        hasValidInput: true,
        isQuoteRequestStarting: false,
        quoteEventCompleted: true,
        quoteRequestMatchesInput: true,
      }),
    ).toBe(false);
    expect(
      shouldShowSwapQuoteRequestLoading({
        swapType: ESwapTabSwitchType.SWAP,
        hasCurrentActionableQuote: false,
        hasValidInput: false,
        isQuoteRequestStarting: false,
        quoteEventCompleted: false,
        quoteRequestMatchesInput: false,
      }),
    ).toBe(false);
  });

  it('keeps Bridge in the same request-start loading contract as Swap', () => {
    const requestState = {
      hasCurrentActionableQuote: false,
      hasValidInput: true,
      isQuoteRequestStarting: false,
      quoteEventCompleted: true,
      quoteRequestMatchesInput: false,
    };

    expect(
      shouldShowSwapQuoteRequestLoading({
        ...requestState,
        swapType: ESwapTabSwitchType.BRIDGE,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapQuoteRequestLoading({
        ...requestState,
        swapType: ESwapTabSwitchType.LIMIT,
      }),
    ).toBe(false);
  });

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

  it('keeps seeded Stock quote events fetching before total quote count arrives', () => {
    expect(
      isSwapQuoteEventFetching({
        quoteEventTotalCount: {
          eventId: 'event-1',
          count: 1,
          totalQuoteCountReceived: false,
        },
        currentEventReceivedCount: 1,
        quoteEventCompleted: false,
      }),
    ).toBe(true);

    expect(
      isSwapQuoteEventFetching({
        quoteEventTotalCount: {
          eventId: 'event-1',
          count: 1,
          totalQuoteCountReceived: false,
        },
        currentEventReceivedCount: 1,
        quoteEventCompleted: true,
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

  it('reports no-provider-supports-trade for the current pair only (OK-57545)', () => {
    // Zero-provider round completed for the current inputs.
    expect(
      isSwapNoProviderSupportsTrade({
        zeroProviderQuoteCompleted: true,
        quote: undefined,
        quoteResultPairNoMatch: false,
      }),
    ).toBe(true);

    // Selected quote carries no toAmount and no limit info.
    expect(
      isSwapNoProviderSupportsTrade({
        zeroProviderQuoteCompleted: false,
        quote: { toAmount: '' },
        quoteResultPairNoMatch: false,
      }),
    ).toBe(true);

    // Real server shape for an unsupported pair: totalQuoteCount > 0 and
    // every provider returns an error quote WITHOUT any amount fields
    // (e.g. "Provider error" / "Insufficient liquidity"). Amount mismatch
    // against the user input must not veto the verdict here.
    expect(
      isSwapNoProviderSupportsTrade({
        zeroProviderQuoteCompleted: false,
        quote: { toAmount: undefined, limit: undefined },
        quoteResultPairNoMatch: false,
      }),
    ).toBe(true);

    // A quote with a limit (e.g. min amount) is not a no-provider verdict.
    expect(
      isSwapNoProviderSupportsTrade({
        zeroProviderQuoteCompleted: false,
        quote: { toAmount: '', limit: { min: '1' } },
        quoteResultPairNoMatch: false,
      }),
    ).toBe(false);

    // An actionable quote is never a no-provider verdict.
    expect(
      isSwapNoProviderSupportsTrade({
        zeroProviderQuoteCompleted: false,
        quote: { toAmount: '10' },
        quoteResultPairNoMatch: false,
      }),
    ).toBe(false);

    // A stale quote left over from a DIFFERENT token pair must not lock the
    // action button out of its "Refresh quotes" recovery state.
    expect(
      isSwapNoProviderSupportsTrade({
        zeroProviderQuoteCompleted: true,
        quote: { toAmount: '' },
        quoteResultPairNoMatch: true,
      }),
    ).toBe(false);
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
    expect(state.isQuotePresentationLoading).toBe(false);
  });

  it('shows quote loading only while waiting without a previous quote', () => {
    const state = getSwapQuoteProgressState({
      quoteLoading: true,
      quoteEventFetching: false,
      quoteEventTotalCount: { count: 0 },
      quoteEventCompleted: false,
    });

    expect(state.phase).toBe(ESwapQuoteUiPhase.Waiting);
    expect(state.displayQuote).toBeUndefined();
    expect(state.isWaitingActionableQuote).toBe(true);
    expect(state.isQuotePresentationLoading).toBe(true);
  });

  it('keeps the compatible display quote during stale refresh', () => {
    const previousQuote = buildQuote({
      eventId: 'event-1',
      provider: 'previous',
    });
    const currentErrorQuote = buildQuote({
      eventId: 'event-2',
      provider: 'current-error',
      toAmount: '0',
      errorMessage: 'Provider error',
    });

    expect(
      resolveSwapQuoteForDisplay({
        quoteResult: currentErrorQuote,
        displayQuote: previousQuote,
        phase: ESwapQuoteUiPhase.StaleRefreshing,
      }),
    ).toBe(previousQuote);
    expect(
      resolveSwapQuoteForDisplay({
        quoteResult: currentErrorQuote,
        displayQuote: previousQuote,
        phase: ESwapQuoteUiPhase.HasQuote,
      }),
    ).toBe(currentErrorQuote);
  });

  it('offers refresh only after quote mismatch and request state settle', () => {
    expect(
      shouldOfferSwapQuoteRefresh({
        isRefreshQuote: false,
        quoteResultNoMatch: false,
        quoteResultNoMatchDebounced: true,
        quoteLoading: false,
        quoteEventFetching: false,
      }),
    ).toBe(false);
    expect(
      shouldOfferSwapQuoteRefresh({
        isRefreshQuote: false,
        quoteResultNoMatch: true,
        quoteResultNoMatchDebounced: true,
        quoteLoading: false,
        quoteEventFetching: true,
      }),
    ).toBe(false);
    expect(
      shouldOfferSwapQuoteRefresh({
        isRefreshQuote: false,
        quoteResultNoMatch: true,
        quoteResultNoMatchDebounced: true,
        quoteLoading: false,
        quoteEventFetching: false,
      }),
    ).toBe(true);
    expect(
      shouldOfferSwapQuoteRefresh({
        isRefreshQuote: true,
        quoteResultNoMatch: false,
        quoteResultNoMatchDebounced: false,
        quoteLoading: true,
        quoteEventFetching: true,
      }),
    ).toBe(true);
  });

  it('stops action loading when the first actionable quote arrives', () => {
    expect(
      shouldShowSwapQuoteActionLoading({
        hasActionableQuote: false,
        isWaitingActionableQuote: true,
        isQuoteEventSettlingForAction: false,
        isWaitingAutoSlippage: false,
        manualRefreshRequired: false,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapQuoteActionLoading({
        hasActionableQuote: false,
        isWaitingActionableQuote: false,
        isQuoteEventSettlingForAction: true,
        isWaitingAutoSlippage: false,
        manualRefreshRequired: false,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapQuoteActionLoading({
        hasActionableQuote: true,
        isWaitingActionableQuote: false,
        isQuoteEventSettlingForAction: false,
        isWaitingAutoSlippage: true,
        manualRefreshRequired: false,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapQuoteActionLoading({
        hasActionableQuote: false,
        isWaitingActionableQuote: false,
        isQuoteEventSettlingForAction: false,
        isWaitingAutoSlippage: false,
        manualRefreshRequired: false,
      }),
    ).toBe(false);
    expect(
      shouldShowSwapQuoteActionLoading({
        hasActionableQuote: true,
        isWaitingActionableQuote: false,
        isQuoteEventSettlingForAction: true,
        isWaitingAutoSlippage: false,
        manualRefreshRequired: false,
      }),
    ).toBe(false);
    expect(
      shouldShowSwapQuoteActionLoading({
        hasActionableQuote: false,
        isWaitingActionableQuote: true,
        isQuoteEventSettlingForAction: true,
        isWaitingAutoSlippage: true,
        manualRefreshRequired: true,
      }),
    ).toBe(false);
  });

  it('keeps a previous actionable quote while the current event is still waiting', () => {
    const previousQuote = buildQuote({
      eventId: 'event-1',
      provider: 'previous',
    });

    const selectedPreviousQuote = selectSwapPreviousActionableQuote({
      quotes: [previousQuote],
      quoteEventTotalCount: { eventId: 'event-2', count: 2 },
      currentEventProviderKeys: [],
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

  it('keeps a retagged provider quote display-only until that provider responds', () => {
    const retainedQuote = buildQuote({
      eventId: 'event-2',
      provider: 'retained-provider',
    });

    expect(
      selectSwapPreviousActionableQuote({
        quotes: [retainedQuote],
        quoteEventTotalCount: { eventId: 'event-2', count: 2 },
        currentEventProviderKeys: ['returned-error-provider'],
        quoteLoading: false,
        quoteEventFetching: true,
      }),
    ).toBe(retainedQuote);
    expect(
      selectSwapPreviousActionableQuote({
        quotes: [retainedQuote],
        quoteEventTotalCount: { eventId: 'event-2', count: 2 },
        currentEventProviderKeys: [
          buildSwapQuoteProviderKey(retainedQuote),
          'returned-error-provider',
        ],
        quoteLoading: false,
        quoteEventFetching: true,
      }),
    ).toBeUndefined();
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

  it('defers non-actionable provider errors while the current event is still waiting for providers', () => {
    const errorQuote = buildQuote({
      eventId: 'event-1',
      provider: 'min-amount-provider',
      toAmount: '0',
      errorMessage: '最低金额要求 100.020304 USDC',
    });

    const selectedQuote = selectSwapCurrentQuote({
      currentEventSortedQuotes: [errorQuote],
      quoteEventTotalCount: {
        eventId: 'event-1',
        count: 2,
        totalQuoteCountReceived: true,
      },
      currentEventProviderKeys: [buildSwapQuoteProviderKey(errorQuote)],
      quoteEventCompleted: false,
      deferNonActionableQuoteUntilEventSettled: true,
    });

    expect(selectedQuote).toBeUndefined();
  });

  it('defers seeded Stock provider errors before total quote count arrives', () => {
    const errorQuote = buildQuote({
      eventId: 'event-1',
      provider: 'min-amount-provider',
      toAmount: '0',
      errorMessage: '最低金额要求 100.020304 USDC',
    });

    const selectedQuote = selectSwapCurrentQuote({
      currentEventSortedQuotes: [errorQuote],
      quoteEventTotalCount: {
        eventId: 'event-1',
        count: 1,
        totalQuoteCountReceived: false,
      },
      currentEventProviderKeys: [buildSwapQuoteProviderKey(errorQuote)],
      quoteEventCompleted: false,
      deferNonActionableQuoteUntilEventSettled: true,
    });

    expect(selectedQuote).toBeUndefined();
  });

  it('does not defer non-actionable quotes when no quote event is active', () => {
    const errorQuote = buildQuote({
      eventId: 'previous-event',
      provider: 'min-amount-provider',
      toAmount: '0',
      errorMessage: '最低金额要求 100.020304 USDC',
    });

    const selectedQuote = selectSwapCurrentQuote({
      currentEventSortedQuotes: [errorQuote],
      quoteEventTotalCount: { count: 0 },
      currentEventProviderKeys: [],
      quoteEventCompleted: false,
      deferNonActionableQuoteUntilEventSettled: true,
    });

    expect(selectedQuote).toBe(errorQuote);
  });

  it('shows a non-actionable provider error after authoritative total count says no providers are pending', () => {
    const errorQuote = buildQuote({
      eventId: 'event-1',
      provider: 'min-amount-provider',
      toAmount: '0',
      errorMessage: '最低金额要求 100.020304 USDC',
    });

    const selectedQuote = selectSwapCurrentQuote({
      currentEventSortedQuotes: [errorQuote],
      quoteEventTotalCount: {
        eventId: 'event-1',
        count: 1,
        totalQuoteCountReceived: true,
      },
      currentEventProviderKeys: [buildSwapQuoteProviderKey(errorQuote)],
      quoteEventCompleted: false,
      deferNonActionableQuoteUntilEventSettled: true,
    });

    expect(selectedQuote).toBe(errorQuote);
  });

  it('shows a non-actionable provider error after the quote event settles without an actionable quote', () => {
    const errorQuote = buildQuote({
      eventId: 'event-1',
      provider: 'min-amount-provider',
      toAmount: '0',
      errorMessage: '最低金额要求 100.020304 USDC',
    });

    const selectedQuote = selectSwapCurrentQuote({
      currentEventSortedQuotes: [errorQuote],
      quoteEventTotalCount: { eventId: 'event-1', count: 2 },
      currentEventProviderKeys: [buildSwapQuoteProviderKey(errorQuote)],
      quoteEventCompleted: true,
      deferNonActionableQuoteUntilEventSettled: true,
    });

    expect(selectedQuote).toBe(errorQuote);
  });

  it('selects an actionable quote while other providers are still pending', () => {
    const errorQuote = buildQuote({
      eventId: 'event-1',
      provider: 'min-amount-provider',
      toAmount: '0',
      errorMessage: '最低金额要求 100.020304 USDC',
    });
    const actionableQuote = buildQuote({
      eventId: 'event-1',
      provider: 'actionable-provider',
      toAmount: '0.3125',
    });

    const selectedQuote = selectSwapCurrentQuote({
      currentEventSortedQuotes: [actionableQuote, errorQuote],
      quoteEventTotalCount: { eventId: 'event-1', count: 3 },
      currentEventProviderKeys: [
        buildSwapQuoteProviderKey(errorQuote),
        buildSwapQuoteProviderKey(actionableQuote),
      ],
      quoteEventCompleted: false,
      deferNonActionableQuoteUntilEventSettled: true,
    });

    expect(selectedQuote).toBe(actionableQuote);
  });

  it('keeps a manually selected non-actionable provider while the event is still waiting', () => {
    const manualErrorQuote = buildQuote({
      eventId: 'event-1',
      provider: 'manual-min-amount-provider',
      toAmount: '0',
      errorMessage: '最低金额要求 100.020304 USDC',
    });

    const selectedQuote = selectSwapCurrentQuote({
      currentEventSortedQuotes: [manualErrorQuote],
      selectionIntent: {
        type: 'manual-provider',
        info: manualErrorQuote.info,
      },
      quoteEventTotalCount: {
        eventId: 'event-1',
        count: 2,
        totalQuoteCountReceived: true,
      },
      currentEventProviderKeys: [buildSwapQuoteProviderKey(manualErrorQuote)],
      quoteEventCompleted: false,
      deferNonActionableQuoteUntilEventSettled: true,
    });

    expect(selectedQuote).toBe(manualErrorQuote);
  });
});
