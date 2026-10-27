// A previously visited market can show its account-scoped snapshot while the
// 60-second request cache revalidates in the background. Match the reserves
// display window so one metric does not turn an otherwise complete snapshot
// back into a loading screen.
export const BORROW_METRIC_DISPLAY_CACHE_MAX_AGE = 30 * 60 * 1000;

export function isBorrowMetricReadyForMarketSwitch({
  isApplicable,
  hasSettledCurrentScope,
  state,
  hasData,
  resolvedAt,
  now,
}: {
  isApplicable: boolean;
  hasSettledCurrentScope: boolean;
  state: 'resolved' | 'error' | 'cancelled' | undefined;
  hasData: boolean;
  resolvedAt: number | undefined;
  now: number;
}): boolean {
  if (!isApplicable) {
    return true;
  }
  if (!hasSettledCurrentScope) {
    return false;
  }
  // A terminal failure can publish its explicit error UI. Cancelled work
  // cannot publish a target market, and an old successful result needs a
  // timestamp to prove that its account-scoped display window still applies.
  if (state === 'error' || (state === 'resolved' && !hasData)) {
    return true;
  }
  return Boolean(
    state === 'resolved' &&
    hasData &&
    resolvedAt &&
    resolvedAt <= now &&
    now - resolvedAt < BORROW_METRIC_DISPLAY_CACHE_MAX_AGE,
  );
}
