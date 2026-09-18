import {
  DETAIL_SETTLE_REFRESH_OFFSETS_MS,
  scheduleSettleRefreshes,
} from './settleRefresh.utils';

// After a first deposit the provider's index can lag the chain; one refresh
// 3s after the confirmation was all the page did, so the Portfolio tab never
// appeared until the page was reopened. The schedule keeps re-reading.

describe('scheduleSettleRefreshes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('refreshes at once and again at every offset', () => {
    const refresh = jest.fn();
    scheduleSettleRefreshes({ refresh, offsetsMs: [100, 300] });

    expect(refresh).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(100);
    expect(refresh).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(200);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('stops re-reading once the page reports it has caught up', () => {
    const refresh = jest.fn();
    let caughtUp = false;
    scheduleSettleRefreshes({
      refresh,
      shouldStop: () => caughtUp,
      offsetsMs: [100, 300],
    });

    jest.advanceTimersByTime(100);
    expect(refresh).toHaveBeenCalledTimes(2);
    caughtUp = true;
    jest.advanceTimersByTime(200);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('cancels the pending reads', () => {
    const refresh = jest.fn();
    const cancel = scheduleSettleRefreshes({ refresh, offsetsMs: [100] });

    cancel();
    jest.advanceTimersByTime(100);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('spreads the default offsets over the first minute', () => {
    expect(DETAIL_SETTLE_REFRESH_OFFSETS_MS).toEqual([10_000, 30_000, 60_000]);
  });
});
