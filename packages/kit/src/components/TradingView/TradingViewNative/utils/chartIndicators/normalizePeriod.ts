export function normalizeTradingViewNativeIndicatorPeriod(period: number) {
  return Number.isFinite(period) ? Math.max(Math.floor(period), 1) : 1;
}
