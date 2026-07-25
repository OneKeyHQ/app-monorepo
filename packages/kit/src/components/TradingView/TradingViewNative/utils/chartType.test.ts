import {
  getTradingViewNativeChartType,
  mergeTradingViewNativePointTypes,
} from './chartType';

describe('TradingViewNative chart type', () => {
  it('uses a line for close-only data regardless of point count', () => {
    expect(
      getTradingViewNativeChartType({ pointCount: 20, pointType: 'single' }),
    ).toBe('line');
  });

  it('uses a line when only one OHLC point is available', () => {
    expect(
      getTradingViewNativeChartType({ pointCount: 1, pointType: 'ohlc' }),
    ).toBe('line');
  });

  it('uses candlesticks for multi-point OHLC data', () => {
    expect(
      getTradingViewNativeChartType({ pointCount: 2, pointType: 'ohlc' }),
    ).toBe('candlestick');
  });

  it('keeps single-value semantics when history batches are merged', () => {
    expect(mergeTradingViewNativePointTypes('ohlc', 'single')).toBe('single');
    expect(mergeTradingViewNativePointTypes('single', 'ohlc')).toBe('single');
    expect(mergeTradingViewNativePointTypes('ohlc', undefined)).toBe('ohlc');
  });
});
