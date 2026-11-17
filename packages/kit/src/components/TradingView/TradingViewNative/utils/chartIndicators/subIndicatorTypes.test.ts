import {
  TRADING_VIEW_NATIVE_SUB_INDICATORS,
  isTradingViewNativeSubIndicator,
} from './subIndicatorTypes';

describe('TradingViewNative secondary indicator types', () => {
  it('exposes the 13 legacy secondary indicator types', () => {
    expect(TRADING_VIEW_NATIVE_SUB_INDICATORS).toEqual([
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
    ]);
    expect(isTradingViewNativeSubIndicator('StochRSI')).toBe(true);
    expect(isTradingViewNativeSubIndicator('BOLL')).toBe(false);
  });
});
