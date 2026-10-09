import { BORROW_DISPLAY_CACHE_MAX_AGE } from '../components/borrowDataGate.utils';

import {
  BORROW_METRIC_DISPLAY_CACHE_MAX_AGE,
  isBorrowMetricReadyForMarketSwitch,
} from './borrowMetricSnapshot.utils';

describe('Borrow metric display snapshot', () => {
  const now = 1_000_000_000;
  const validResult = {
    isApplicable: true,
    hasSettledCurrentScope: true,
    state: 'resolved' as const,
    hasData: true,
    resolvedAt: now - 60_001,
    now,
  };

  it('shares the reserves display window while request freshness can be shorter', () => {
    expect(BORROW_METRIC_DISPLAY_CACHE_MAX_AGE).toBe(
      BORROW_DISPLAY_CACHE_MAX_AGE,
    );
    expect(isBorrowMetricReadyForMarketSwitch(validResult)).toBe(true);
    expect(
      isBorrowMetricReadyForMarketSwitch({
        ...validResult,
        resolvedAt: now - BORROW_METRIC_DISPLAY_CACHE_MAX_AGE,
      }),
    ).toBe(false);
  });

  it('requires a current, timestamped snapshot or a terminal error', () => {
    expect(
      isBorrowMetricReadyForMarketSwitch({
        ...validResult,
        hasSettledCurrentScope: false,
      }),
    ).toBe(false);
    expect(
      isBorrowMetricReadyForMarketSwitch({
        ...validResult,
        resolvedAt: undefined,
      }),
    ).toBe(false);
    expect(
      isBorrowMetricReadyForMarketSwitch({
        ...validResult,
        state: 'cancelled',
      }),
    ).toBe(false);
    expect(
      isBorrowMetricReadyForMarketSwitch({
        ...validResult,
        state: 'error',
        hasData: false,
        resolvedAt: undefined,
      }),
    ).toBe(true);
  });
});
