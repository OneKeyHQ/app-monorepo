export const TRADING_VIEW_NATIVE_SUB_INDICATORS = [
  'VOL',
  'MACD',
  'RSI',
  'StochRSI',
  'OBV',
  'MFI',
  'TRIX',
  'EMV',
  'WR',
  'ROC',
  'MTM',
  'DMI',
  'CCI',
] as const;

export type ITradingViewNativeSubIndicator =
  (typeof TRADING_VIEW_NATIVE_SUB_INDICATORS)[number];

export type ITradingViewNativeIndicatorValues = Array<number | null>;

export function isTradingViewNativeSubIndicator(
  value: string,
): value is ITradingViewNativeSubIndicator {
  return (TRADING_VIEW_NATIVE_SUB_INDICATORS as readonly string[]).includes(
    value,
  );
}
