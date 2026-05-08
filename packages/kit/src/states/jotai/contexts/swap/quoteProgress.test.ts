import {
  getSwapQuoteEventProgressTotalCount,
  isSwapQuoteEventFetching,
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
});
