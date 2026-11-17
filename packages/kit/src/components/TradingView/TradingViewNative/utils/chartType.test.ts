import {
  TRADING_VIEW_NATIVE_CHART_TYPE_OPTIONS,
  getTradingViewNativeChartType,
  getTradingViewNativeChartTypeFromValue,
  getTradingViewNativeChartTypeValue,
  getTradingViewNativePrimarySeriesModel,
  getTradingViewNativePrimarySeriesPoints,
  getTradingViewNativeRenderDataRevision,
  isTradingViewNativeSingleValueHistory,
  resolveTradingViewNativeChartType,
} from './chartType';

describe('TradingViewNative chart type', () => {
  it('uses a line for single-value history and one-point OHLC history', () => {
    expect(
      getTradingViewNativeChartType({
        hasSingleValueHistory: true,
        pointCount: 2,
      }),
    ).toBe('line');
    expect(
      getTradingViewNativeChartType({
        hasSingleValueHistory: false,
        pointCount: 1,
      }),
    ).toBe('line');
    expect(
      getTradingViewNativeChartType({
        hasSingleValueHistory: false,
        pointCount: 2,
      }),
    ).toBe('candlestick');
  });

  it('recognizes only explicit single-value history metadata', () => {
    expect(isTradingViewNativeSingleValueHistory('single')).toBe(true);
    expect(isTradingViewNativeSingleValueHistory('ohlc')).toBe(false);
    expect(isTradingViewNativeSingleValueHistory()).toBe(false);
  });

  it('uses the same five chart type values as the shared controls', () => {
    expect(TRADING_VIEW_NATIVE_CHART_TYPE_OPTIONS).toEqual([
      { id: 'candlestick', label: 'Candles', value: 1 },
      { id: 'heikinAshi', label: 'Heikin Ashi', value: 8 },
      { id: 'bars', label: 'Bars', value: 0 },
      { id: 'line', label: 'Line', value: 2 },
      { id: 'area', label: 'Area', value: 3 },
    ]);
    expect(getTradingViewNativeChartTypeFromValue(8)).toBe('heikinAshi');
    expect(getTradingViewNativeChartTypeValue('area')).toBe(3);
    expect(getTradingViewNativeChartTypeFromValue(21)).toBeUndefined();
  });

  it('keeps automatic data-based defaults until a chart type is selected', () => {
    expect(
      resolveTradingViewNativeChartType({
        automaticChartType: 'line',
        preference: 'auto',
      }),
    ).toBe('line');
    expect(
      resolveTradingViewNativeChartType({
        automaticChartType: 'line',
        preference: 'bars',
      }),
    ).toBe('bars');
  });

  it('defines rendering and price semantics for every chart type', () => {
    expect(getTradingViewNativePrimarySeriesModel('candlestick')).toMatchObject(
      {
        colorRole: 'directional',
        pointTransform: 'identity',
        priceSource: 'ohlc',
        renderKind: 'candles',
      },
    );
    expect(getTradingViewNativePrimarySeriesModel('heikinAshi')).toMatchObject({
      colorRole: 'directional',
      pointTransform: 'heikinAshi',
      priceSource: 'ohlc',
      renderKind: 'candles',
    });
    expect(getTradingViewNativePrimarySeriesModel('bars')).toMatchObject({
      colorRole: 'directional',
      priceSource: 'ohlc',
      renderKind: 'bars',
    });
    expect(getTradingViewNativePrimarySeriesModel('line')).toMatchObject({
      colorRole: 'line',
      fillArea: false,
      priceSource: 'close',
      renderKind: 'line',
    });
    expect(getTradingViewNativePrimarySeriesModel('area')).toMatchObject({
      colorRole: 'up',
      fillArea: true,
      priceSource: 'close',
      renderKind: 'line',
    });
  });

  it('revises render data only when its source data semantics change', () => {
    const getRevision = (
      chartType: Parameters<
        typeof getTradingViewNativeRenderDataRevision
      >[0]['chartType'],
    ) =>
      getTradingViewNativeRenderDataRevision({
        chartPictureVersion: 2,
        chartType,
      });

    expect(getRevision('candlestick')).toBe('2:identity');
    expect(getRevision('bars')).toBe(getRevision('candlestick'));
    expect(getRevision('line')).toBe(getRevision('candlestick'));
    expect(getRevision('heikinAshi')).toBe('2:heikinAshi');
  });

  it('derives recursive Heikin Ashi OHLC values without changing raw points', () => {
    const points = [
      { c: 106, h: 110, l: 90, o: 100, t: 1, v: 10 },
      { c: 108, h: 112, l: 100, o: 106, t: 2, v: 20 },
    ];

    expect(
      getTradingViewNativePrimarySeriesPoints({
        chartType: 'heikinAshi',
        points,
      }),
    ).toEqual([
      { c: 101.5, h: 110, l: 90, o: 103, t: 1, v: 10 },
      { c: 106.5, h: 112, l: 100, o: 102.25, t: 2, v: 20 },
    ]);
    expect(points[0]).toEqual({
      c: 106,
      h: 110,
      l: 90,
      o: 100,
      t: 1,
      v: 10,
    });
    expect(
      getTradingViewNativePrimarySeriesPoints({ chartType: 'bars', points }),
    ).toBe(points);
  });
});
