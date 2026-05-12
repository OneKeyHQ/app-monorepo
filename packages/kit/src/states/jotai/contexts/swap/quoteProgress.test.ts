import {
  getSwapQuoteEventProgressTotalCount,
  hasSwapQuoteEventTotalCount,
  hasSwapZeroProviderQuoteEvent,
  isSwapQuoteEventFetching,
  isSwapZeroProviderQuoteCompleted,
} from './quoteProgress';

describe('swap quote progress', () => {
  it('caps quote event total count for scoped provider flows', () => {
    expect(
      getSwapQuoteEventProgressTotalCount({
        quoteEventTotalCount: { eventId: 'event-1', count: 6 },
        maxQuoteCount: 2,
      }),
    ).toEqual({ eventId: 'event-1', count: 2 });
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
});
