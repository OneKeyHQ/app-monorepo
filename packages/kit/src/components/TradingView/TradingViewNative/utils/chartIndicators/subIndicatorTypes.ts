export const TRADING_VIEW_NATIVE_SUB_INDICATORS = [
  'VOL',
  'MACD',
  'KDJ',
  'SKDJ',
  'RSI',
  'StochRSI',
  'OBV',
  'MFI',
  'DMA',
  'TRIX',
  'VR',
  'BRAR',
  'EMV',
  'WR',
  'ROC',
  'MTM',
  'PSY',
  'DMI',
  'CCI',
  'PVT',
  'ATR',
  'SMI',
  'TSI',
  'RVI',
  'QQE',
  'MASS',
  'KST',
  'BBP',
  'NVI',
  'PMO',
  'RCI',
  'SLOPE',
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
