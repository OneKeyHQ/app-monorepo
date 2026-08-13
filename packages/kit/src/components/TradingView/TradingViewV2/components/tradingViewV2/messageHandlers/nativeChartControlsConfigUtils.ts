export function normalizeTradingViewLayoutRestored(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}
