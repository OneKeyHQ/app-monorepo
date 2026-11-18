import {
  TRADING_VIEW_NATIVE_SUB_INDICATORS,
  isTradingViewNativeSubIndicator,
} from './subIndicatorTypes';

// cspell:ignore BRAR KDJ SKDJ StochRSI TRIX
describe('TradingViewNative secondary indicator types', () => {
  it('exposes the secondary indicator types in their display order', () => {
    expect(TRADING_VIEW_NATIVE_SUB_INDICATORS).toEqual([
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
    ]);
    expect(isTradingViewNativeSubIndicator('StochRSI')).toBe(true);
    expect(isTradingViewNativeSubIndicator('BOLL')).toBe(false);
  });
});
