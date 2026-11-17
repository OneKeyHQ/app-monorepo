import {
  DETAIL_BALANCE_SETTLE_REFRESH_OFFSETS_MS,
  DETAIL_PORTFOLIO_SETTLE_REFRESH_OFFSETS_MS,
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

  it('cancels every pending read', () => {
    const refresh = jest.fn();
    const cancel = scheduleSettleRefreshes({ refresh, offsetsMs: [100, 300] });

    jest.advanceTimersByTime(100);
    cancel();
    jest.advanceTimersByTime(300);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('gives an existing position one fallback read and a new one a minute', () => {
    expect(DETAIL_BALANCE_SETTLE_REFRESH_OFFSETS_MS).toEqual([10_000]);
    expect(DETAIL_PORTFOLIO_SETTLE_REFRESH_OFFSETS_MS).toEqual([
      10_000, 30_000, 60_000,
    ]);
  });
});
