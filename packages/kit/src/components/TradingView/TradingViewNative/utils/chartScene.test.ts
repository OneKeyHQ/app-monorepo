import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import { createTradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import {
  TRADING_VIEW_NATIVE_CHART_DOWN_COLOR,
  TRADING_VIEW_NATIVE_CHART_UP_COLOR,
  TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_LEFT_PADDING,
} from '../chartConstants';

import { buildTradingViewNativeIndicatorSeries } from './chartIndicators';
import {
  buildTradingViewNativeChartScene,
  getTradingViewNativeChartScenePaintStyles,
} from './chartScene';
import { createTradingViewNativeSubIndicatorRenderSnapshots } from './subIndicatorRender';

const POINTS: IMarketTokenKLineDataPoint[] = [
  { c: 101, h: 103, l: 98, o: 100, t: 1_700_000_000, v: 10 },
  { c: 99, h: 102, l: 97, o: 101, t: 1_700_003_600, v: 20 },
  { c: 104, h: 105, l: 98, o: 99, t: 1_700_007_200, v: 15 },
];

const CANDLE_LABELS = {
  close: 'C',
  high: 'H',
  low: 'L',
  open: 'O',
};

function buildLinearPoints(count: number): IMarketTokenKLineDataPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    c: 100 + index,
    h: 102 + index,
    l: 98 + index,
    o: 99 + index,
    t: 1_700_000_000 + index * 3600,
    v: 10,
  }));
}

describe('TradingViewNative shared chart scene', () => {
  it('describes the complete chart without a Canvas or Skia dependency', () => {
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: true, x: 264.5, y: 80 },
      hasVolume: true,
      height: 240,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: POINTS,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });
    const paints = new Set(
      scene.commands.flatMap((command) =>
        'paint' in command ? [command.paint] : [],
      ),
    );
    const text = scene.commands.flatMap((command) =>
      command.kind === 'text' ? [command.text] : [],
    );

    expect(scene.visiblePointRange).toEqual({
      endIndex: POINTS.length,
      startIndex: 0,
    });
    expect(scene.autoPriceRange).toEqual({ maxPrice: 105, minPrice: 97 });
    expect(scene.crosshairPointIndex).toBe(POINTS.length - 1);
    expect(scene.commands[0]).toMatchObject({
      height: 240,
      kind: 'rect',
      paint: 'background',
      width: 320,
    });
    expect(scene.commands.some((command) => command.kind === 'watermark')).toBe(
      true,
    );
    expect([...paints]).toEqual(
      expect.arrayContaining([
        'axisText',
        'crosshairLabelBackground',
        'crosshairLine',
        'down',
        'downVolume',
        'gridLine',
        'legendBackground',
        'up',
        'upCurrentPriceLine',
        'upVolume',
      ]),
    );
    expect(text).toEqual(
      expect.arrayContaining(['O', 'H', 'L', 'C', '+5 (+5.05%)', 'Volume']),
    );
    expect(
      scene.commands.filter((command) => command.kind === 'clip'),
    ).toHaveLength(
      scene.commands.filter((command) => command.kind === 'restore').length,
    );

    const priceAxisX = 320 - scene.priceAxisWidth;
    const timeAxisBorder = scene.commands.find(
      (command) => command.kind === 'line' && command.paint === 'gridSolidLine',
    );
    expect(timeAxisBorder).toMatchObject({ x1: 0, x2: priceAxisX });
    const priceAxisTextX = scene.commands.flatMap((command) =>
      command.kind === 'text' &&
      command.font === 'priceAxis' &&
      command.x >= priceAxisX
        ? [command.x]
        : [],
    );
    expect(priceAxisTextX.length).toBeGreaterThan(0);
    expect(new Set(priceAxisTextX)).toEqual(
      new Set([priceAxisX + TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_LEFT_PADDING]),
    );
  });

  it('normalizes invalid viewport bounds before producing commands', () => {
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: false,
      height: 240,
      measureTextWidth: () => 0,
      candleLabels: CANDLE_LABELS,
      points: [],
      viewport: { offset: 999, zoomScale: 999 },
      watermarkOpacity: 0.08,
      width: 320,
    });

    expect(scene.viewport).toEqual({
      offset: 0,
      zoomScale: TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
    });
    expect(scene.crosshairPointIndex).toBeNull();
    expect(scene.visiblePointRange).toEqual({ endIndex: 0, startIndex: 0 });
    expect(scene.commands.map((command) => command.kind)).toEqual([
      'rect',
      'watermark',
    ]);
  });

  it('centers the watermark within a small main chart', () => {
    const height = 360;
    const timeAxisHeight = 20;
    const width = 320;
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: false,
      height,
      isMobileLayout: true,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: POINTS,
      subIndicatorPanes: createTradingViewNativeSubIndicatorRenderSnapshots({
        configs: [{ id: 'RSI', indicator: 'RSI' }],
        points: POINTS,
      }).map(({ pane }) => pane),
      timeAxisHeight,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width,
    });
    const watermark = scene.commands.find(
      (command) => command.kind === 'watermark',
    );
    const paneTopBorder = scene.commands.find(
      (command) =>
        command.kind === 'line' &&
        command.paint === 'gridSolidLine' &&
        command.y1 === 284 &&
        command.y2 === 284,
    );
    expect(paneTopBorder).toBeDefined();
    expect(watermark).toMatchObject({
      kind: 'watermark',
      rect: { width: 70.4, x: 124.8 },
    });
    if (watermark?.kind === 'watermark') {
      expect(watermark.rect.y + watermark.rect.height / 2).toBeCloseTo(142);
    }
  });

  it('applies persisted display settings to the shared render scene', () => {
    const chartSettings = createTradingViewNativeChartSettings();
    chartSettings.background = {
      style: 'gradient',
      colors: ['#010203', '#040506'],
    };
    chartSettings.grid.style = 'none';
    chartSettings.options.yAxis = false;
    chartSettings.options.crossLine = false;
    chartSettings.options.latestPrice = false;
    chartSettings.options.priceChange = false;
    chartSettings.candles.body.enabled = false;
    chartSettings.candles.wick.enabled = false;
    chartSettings.candles.border = {
      enabled: true,
      upColor: '#112233',
      downColor: '#445566',
    };

    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartSettings,
      chartType: 'candlestick',
      crosshair: { visible: true, x: 264.5, y: 80 },
      currentPriceLabel: '104.00',
      hasVolume: false,
      height: 240,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: POINTS,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });

    expect(scene.commands[0]).toEqual({
      colors: ['#010203', '#040506'],
      kind: 'linearGradientRect',
      rect: { height: 240, width: 320, x: 0, y: 0 },
    });
    expect(scene.priceAxisWidth).toBe(0);
    expect(scene.crosshairPointIndex).toBeNull();
    expect(
      scene.commands.some(
        (command) => 'paint' in command && command.paint === 'gridLine',
      ),
    ).toBe(false);
    expect(
      scene.commands.some(
        (command) =>
          'paint' in command &&
          (command.paint === 'upCurrentPriceLine' ||
            command.paint === 'downCurrentPriceLine'),
      ),
    ).toBe(false);
    expect(
      scene.commands.some(
        (command) =>
          command.kind === 'text' && command.text.includes('(+5.05%)'),
      ),
    ).toBe(false);
    expect(
      scene.commands.flatMap((command) =>
        command.kind === 'rect' &&
        command.customPaintId?.startsWith('chart.candle.')
          ? [command.customPaintId]
          : [],
      ),
    ).toEqual([
      'chart.candle.border.up',
      'chart.candle.border.down',
      'chart.candle.border.up',
    ]);
    expect(scene.customPaintStyles['chart.candle.border.up']).toMatchObject({
      color: '#112233',
      drawStyle: 'stroke',
    });
  });

  it('does not layer a matching translucent border over the candle body', () => {
    const chartSettings = createTradingViewNativeChartSettings();
    chartSettings.candles.body = {
      enabled: true,
      downColor: 'rgba(200, 0, 0, 0.5)',
      upColor: 'rgba(0, 160, 80, 0.5)',
    };
    chartSettings.candles.border = {
      ...chartSettings.candles.body,
      enabled: true,
    };

    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartSettings,
      chartType: 'candlestick',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: false,
      height: 240,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: POINTS,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });
    const candlePaintIds = scene.commands.flatMap((command) =>
      command.kind === 'rect' &&
      command.customPaintId?.startsWith('chart.candle.')
        ? [command.customPaintId]
        : [],
    );

    expect(candlePaintIds).toEqual(
      expect.arrayContaining([
        'chart.candle.body.up',
        'chart.candle.body.down',
      ]),
    );
    expect(candlePaintIds.some((paintId) => paintId.includes('.border.'))).toBe(
      false,
    );
  });

  it('styles the latest price, grid, and crosshair from settings', () => {
    const chartSettings = createTradingViewNativeChartSettings();
    chartSettings.grid = {
      style: 'horizontal',
      horizontalColor: '#111111',
      verticalColor: '#222222',
    };
    chartSettings.crossLine = { color: '#ABCDEF', style: 'solid' };
    chartSettings.latestPriceLine = {
      upColor: '#123456',
      downColor: '#654321',
      style: 'solid',
    };

    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartSettings,
      chartType: 'candlestick',
      crosshair: { visible: true, x: 264.5, y: 80 },
      currentPriceLabel: '104.00',
      hasVolume: false,
      height: 240,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: POINTS,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });

    expect(scene.customPaintStyles['chart.crosshair']).toMatchObject({
      color: '#ABCDEF',
      dash: undefined,
    });
    expect(scene.customPaintStyles['chart.latestPrice.line.up']).toMatchObject({
      color: '#123456',
      dash: undefined,
    });
    expect(
      scene.commands.find(
        (command) => command.kind === 'text' && command.text === '104.00',
      ),
    ).toBeDefined();
    expect(
      scene.commands.some(
        (command) =>
          'customPaintId' in command &&
          command.customPaintId === 'chart.grid.vertical',
      ),
    ).toBe(false);
  });

  it('renders active overlays and includes Bollinger bands in auto scale', () => {
    const indicatorPoints = Array.from({ length: 25 }, (_, index) => {
      const close = index < 10 ? 0 : 100;
      return {
        c: close,
        h: close + 1,
        l: close - 1,
        o: close,
        t: 1_700_000_000 + index * 3600,
        v: 10,
      };
    });
    const indicatorSeries = buildTradingViewNativeIndicatorSeries({
      activeIndicatorValues: new Set(['MA', 'EMA', 'BOLL', 'SAR']),
      points: indicatorPoints,
    });
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: false,
      height: 240,
      indicatorSeries,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: indicatorPoints,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });
    const indicatorPaints = scene.commands.flatMap((command) =>
      'paint' in command && command.paint.startsWith('indicator')
        ? [command.paint]
        : [],
    );
    const priceAxisText = scene.commands.flatMap((command) =>
      command.kind === 'text' && command.font === 'priceAxis'
        ? [command.text]
        : [],
    );

    expect(indicatorPaints).toEqual(
      expect.arrayContaining([
        'indicatorOrangeStroke',
        'indicatorPinkStroke',
        'indicatorCyanStroke',
        'indicatorSarPoint',
      ]),
    );
    const mainIndicatorLegendLabels = scene.commands.flatMap((command) =>
      command.kind === 'text' &&
      command.font === 'legend' &&
      /^(?:MA|EMA)\d+$/.test(command.text)
        ? [command]
        : [],
    );
    expect(mainIndicatorLegendLabels.map(({ text }) => text)).toEqual([
      'MA5',
      'MA10',
      'MA20',
      'EMA5',
      'EMA10',
      'EMA20',
    ]);
    expect(
      mainIndicatorLegendLabels.every((command) =>
        command.customPaintId?.endsWith(':legend'),
      ),
    ).toBe(true);
    const maLegendYValues = [
      ...new Set(
        mainIndicatorLegendLabels
          .filter(({ text }) => text.startsWith('MA'))
          .map(({ y }) => y),
      ),
    ];
    const emaLegendYValues = [
      ...new Set(
        mainIndicatorLegendLabels
          .filter(({ text }) => text.startsWith('EMA'))
          .map(({ y }) => y),
      ),
    ];
    expect(maLegendYValues).toHaveLength(1);
    expect(emaLegendYValues).toHaveLength(1);
    const [maLegendY] = maLegendYValues;
    const [emaLegendY] = emaLegendYValues;
    if (maLegendY !== undefined && emaLegendY !== undefined) {
      const priceLegendYValues = scene.commands.flatMap((command) =>
        command.kind === 'text' &&
        command.font === 'legend' &&
        ['O', 'H', 'L', 'C'].includes(command.text)
          ? [command.y]
          : [],
      );
      expect(priceLegendYValues.length).toBeGreaterThan(0);
      expect(maLegendY).toBeGreaterThan(Math.max(...priceLegendYValues));
      expect(emaLegendY).toBeGreaterThan(maLegendY);
    }
    const bollFillIndex = scene.commands.findIndex(
      (command) =>
        command.kind === 'polygon' &&
        command.customPaintId === 'chart.mainIndicator.BOLL.boll-upper:fill',
    );
    const firstCandleIndex = scene.commands.findIndex(
      (command) => command.kind === 'rect' && command.paint === 'up',
    );
    expect(bollFillIndex).toBeGreaterThan(-1);
    expect(bollFillIndex).toBeLessThan(firstCandleIndex);
    expect(priceAxisText).toContain('-50.00');
    expect(Math.max(...priceAxisText.map(Number))).toBeGreaterThan(101);
  });

  it('uses configured main-indicator paint styles', () => {
    const indicatorSeries = buildTradingViewNativeIndicatorSeries({
      activeIndicatorValues: new Set(['MA']),
      indicatorSettings: {
        MA: {
          active: true,
          id: 'MA',
          lines: {
            'line:0': {
              color: '#123456',
              enabled: true,
              period: 2,
              style: 'dashed',
            },
          },
          parameters: {},
          transparency: 25,
        },
      },
      points: POINTS,
    });
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: false,
      height: 240,
      indicatorSeries,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: POINTS,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });
    const customPaintId = 'chart.mainIndicator.MA.ma-1';

    expect(scene.customPaintStyles[customPaintId]).toMatchObject({
      color: '#123456',
      dash: [6, 4],
      opacity: 0.75,
      strokeWidth: 1,
    });
    expect(
      scene.commands.some(
        (command) =>
          'customPaintId' in command && command.customPaintId === customPaintId,
      ),
    ).toBe(true);
  });

  it('renders the BOLL fill without hidden boundary strokes', () => {
    const points = buildLinearPoints(25);
    const indicatorSeries = buildTradingViewNativeIndicatorSeries({
      activeIndicatorValues: new Set(['BOLL']),
      indicatorSettings: {
        BOLL: {
          active: true,
          id: 'BOLL',
          lines: {
            background: {
              color: '#FFAA00',
              enabled: true,
              period: 0,
              style: 'solid',
            },
            lower: {
              color: '#FFAA00',
              enabled: false,
              period: 0,
              style: 'solid',
            },
            middle: {
              color: '#FFAA00',
              enabled: false,
              period: 0,
              style: 'solid',
            },
            upper: {
              color: '#FFAA00',
              enabled: false,
              period: 0,
              style: 'solid',
            },
          },
          parameters: { deviation: 2, period: 20 },
          transparency: 0,
        },
      },
      points,
    });
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: false,
      height: 240,
      indicatorSeries,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });

    expect(
      scene.commands.some(
        (command) =>
          command.kind === 'polygon' &&
          command.customPaintId === 'chart.mainIndicator.BOLL.boll-upper:fill',
      ),
    ).toBe(true);
    expect(
      scene.commands.some(
        (command) =>
          command.kind === 'polyline' &&
          (command.customPaintId === 'chart.mainIndicator.BOLL.boll-upper' ||
            command.customPaintId === 'chart.mainIndicator.BOLL.boll-lower'),
      ),
    ).toBe(false);
  });

  it('uses the previous close for the selected bar change', () => {
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: true,
      height: 240,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: [
        { c: 100_000, h: 100_500, l: 99_500, o: 99_800, t: 1, v: 10 },
        { c: 101_000, h: 102_500, l: 101_000, o: 102_000, t: 2, v: 10 },
      ],
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });

    const changeText = scene.commands.find(
      (command) => command.kind === 'text' && command.text.includes('(+1%)'),
    );
    expect(changeText).toMatchObject({
      text: '+1000 (+1%)',
    });
    expect(changeText?.kind).toBe('text');
    if (changeText?.kind === 'text') {
      expect(changeText.y).toBeGreaterThan(20);
    }
  });

  it('omits empty volume and keeps small positive volume visible', () => {
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: true,
      height: 240,
      measureTextWidth: () => 0,
      candleLabels: CANDLE_LABELS,
      points: [
        { ...POINTS[0], v: 0 },
        { ...POINTS[1], v: 100 },
        { ...POINTS[2], v: 0.000_001 },
      ],
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });
    const volumeBarHeights = scene.commands.flatMap((command) =>
      command.kind === 'rect' &&
      (command.paint === 'upVolume' || command.paint === 'downVolume')
        ? [command.height]
        : [],
    );

    expect(volumeBarHeights).toHaveLength(2);
    expect(volumeBarHeights).toContain(1);
  });

  it('renders volume-axis ticks and a volume crosshair label', () => {
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: true, x: 352, y: 250.8 },
      hasVolume: true,
      height: 300,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: POINTS,
      priceAxisWidth: 44,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 402,
    });
    const volumeAxisText = scene.commands.flatMap((command) =>
      command.kind === 'text' &&
      command.font === 'priceAxis' &&
      command.paint === 'axisText' &&
      command.y > 225.6
        ? [command.text]
        : [],
    );
    const crosshairValueText = scene.commands.find(
      (command) =>
        command.kind === 'text' &&
        command.font === 'priceAxis' &&
        command.paint === 'crosshairLabelText',
    );

    expect(volumeAxisText).toEqual(['13.3333', '6.66667']);
    expect(crosshairValueText).toMatchObject({ text: '10' });
  });

  it('hides the volume legend when the token has no volume', () => {
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: false,
      height: 240,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: POINTS.map((point) => ({ ...point, v: 0 })),
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });
    const text = scene.commands.flatMap((command) =>
      command.kind === 'text' ? [command.text] : [],
    );

    expect(text).not.toContain('Volume');
    expect(
      scene.commands.some(
        (command) =>
          'paint' in command &&
          (command.paint === 'upVolume' || command.paint === 'downVolume'),
      ),
    ).toBe(false);
  });

  it('maps semantic paints to the same platform-neutral colors', () => {
    const styles = getTradingViewNativeChartScenePaintStyles({
      axisText: '#111111',
      background: '#222222',
      grid: '#333333',
      line: '#444444',
    });

    expect(styles.up.color).toBe(TRADING_VIEW_NATIVE_CHART_UP_COLOR);
    expect(styles.down.color).toBe(TRADING_VIEW_NATIVE_CHART_DOWN_COLOR);
    expect(styles.gridLine.dash).toEqual([2, 4]);
    expect(styles.crosshairLine.opacity).toBe(0.6);
    expect(styles.line.color).toBe('#444444');
    expect(styles.areaFill).toMatchObject({
      color: TRADING_VIEW_NATIVE_CHART_UP_COLOR,
      opacity: 0.12,
    });
    expect(styles.areaStroke).toMatchObject({
      color: TRADING_VIEW_NATIVE_CHART_UP_COLOR,
      drawStyle: 'stroke',
      strokeCap: 'round',
      strokeJoin: 'round',
      strokeWidth: 2,
    });
    expect(styles.lineStroke).toMatchObject({
      color: '#444444',
      drawStyle: 'stroke',
      strokeCap: 'round',
      strokeJoin: 'round',
      strokeWidth: 2,
    });
  });

  it('describes a themed line while retaining directional current price', () => {
    const linePoints: IMarketTokenKLineDataPoint[] = [
      { c: 200, h: 200, l: 200, o: 200, t: 1_700_000_000, v: 10 },
      { c: 100, h: 200, l: 100, o: 200, t: 1_700_003_600, v: 20 },
      { c: 110, h: 110, l: 90, o: 90, t: 1_700_007_200, v: 15 },
    ];
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'line',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: true,
      height: 240,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: linePoints,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });
    const line = scene.commands.find((command) => command.kind === 'polyline');
    const endpoint = scene.commands.find(
      (command) => command.kind === 'circle',
    );
    const text = scene.commands.flatMap((command) =>
      command.kind === 'text' ? [command.text] : [],
    );
    const linePrice = scene.commands.find(
      (command) =>
        command.kind === 'text' &&
        command.font === 'legend' &&
        command.text === '110.00',
    );
    const linePriceChange = scene.commands.find(
      (command) => command.kind === 'text' && command.text === '+10 (+10%)',
    );

    expect(line).toMatchObject({
      kind: 'polyline',
      paint: 'lineStroke',
    });
    expect(line && 'points' in line ? line.points : []).toHaveLength(
      linePoints.length,
    );
    expect(endpoint).toMatchObject({
      kind: 'circle',
      paint: 'line',
      radius: 2.5,
    });
    expect(linePrice).toMatchObject({ paint: 'line' });
    expect(linePriceChange).toMatchObject({ paint: 'up' });
    expect(text).toEqual(expect.arrayContaining(['Price', '+10 (+10%)']));
    expect(text).not.toEqual(expect.arrayContaining(['O', 'H', 'L', 'C']));
    expect(
      scene.commands.some(
        (command) =>
          command.kind === 'line' && command.paint === 'upCurrentPriceLine',
      ),
    ).toBe(true);
    expect(
      scene.commands.some(
        (command) => command.kind === 'line' && command.paint === 'axisText',
      ),
    ).toBe(false);
  });

  it('colors a negative line price change with the down paint', () => {
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'line',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: false,
      height: 240,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: [
        { c: 100, h: 100, l: 100, o: 100, t: 1_700_000_000, v: 0 },
        { c: 90, h: 100, l: 90, o: 100, t: 1_700_003_600, v: 0 },
      ],
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });

    expect(
      scene.commands.find(
        (command) =>
          command.kind === 'text' &&
          command.font === 'legend' &&
          command.text === '90.00',
      ),
    ).toMatchObject({ paint: 'line' });
    expect(
      scene.commands.find(
        (command) => command.kind === 'text' && command.text === '-10 (-10%)',
      ),
    ).toMatchObject({ paint: 'down' });
  });

  it('fills an area below the close-price line', () => {
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'area',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: false,
      height: 240,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: POINTS,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });
    const area = scene.commands.find(
      (command) => command.kind === 'polygon' && command.paint === 'areaFill',
    );
    const line = scene.commands.find(
      (command) =>
        command.kind === 'polyline' && command.paint === 'areaStroke',
    );
    const latestPoint = scene.commands.find(
      (command) => command.kind === 'circle' && command.paint === 'up',
    );
    const priceLegend = scene.commands.find(
      (command) =>
        command.kind === 'text' &&
        command.text === 'Price' &&
        command.paint === 'axisText',
    );
    const priceLegendValue = scene.commands.find(
      (command) =>
        command.kind === 'text' &&
        command.text === '104.00' &&
        command.paint === 'up',
    );
    const text = scene.commands.flatMap((command) =>
      command.kind === 'text' ? [command.text] : [],
    );

    expect(area).toMatchObject({ kind: 'polygon', paint: 'areaFill' });
    expect(area?.kind === 'polygon' ? area.points : []).toHaveLength(
      POINTS.length + 2,
    );
    expect(line).toMatchObject({ kind: 'polyline', paint: 'areaStroke' });
    expect(latestPoint).toMatchObject({ kind: 'circle', paint: 'up' });
    expect(priceLegend).toBeDefined();
    expect(priceLegendValue).toBeDefined();
    expect(text).toContain('Price');
    expect(text).not.toEqual(expect.arrayContaining(['O', 'H', 'L', 'C']));
  });

  it('draws OHLC bars with open and close ticks', () => {
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'bars',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: false,
      height: 240,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: POINTS,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });
    const barLines = scene.commands.filter(
      (command) =>
        command.kind === 'line' &&
        (command.paint === 'up' || command.paint === 'down'),
    );
    const candleRects = scene.commands.filter(
      (command) =>
        command.kind === 'rect' &&
        command.customPaintId?.startsWith('chart.candle.'),
    );
    const text = scene.commands.flatMap((command) =>
      command.kind === 'text' ? [command.text] : [],
    );

    expect(barLines).toHaveLength(POINTS.length * 3);
    expect(candleRects).toHaveLength(0);
    expect(text).toEqual(expect.arrayContaining(['O', 'H', 'L', 'C']));
  });

  it('keeps a long price change visible on narrow charts', () => {
    const points: IMarketTokenKLineDataPoint[] = [
      {
        c: 100_000,
        h: 101_000,
        l: 99_000,
        o: 100_000,
        t: 1_700_000_000,
        v: 10,
      },
      {
        c: 105_000,
        h: 106_000,
        l: 99_000,
        o: 100_000,
        t: 1_700_003_600,
        v: 20,
      },
      {
        c: 123_456,
        h: 124_000,
        l: 104_000,
        o: 122_000,
        t: 1_700_007_200,
        v: 15,
      },
    ];

    for (const width of [320, 360]) {
      const scene = buildTradingViewNativeChartScene({
        candleIntervalSeconds: 3600,
        chartType: 'candlestick',
        crosshair: { visible: false, x: 0, y: 0 },
        hasVolume: true,
        height: 240,
        measureTextWidth: (text) => text.length * 6,
        candleLabels: CANDLE_LABELS,
        points,
        viewport: { offset: 0, zoomScale: 1 },
        watermarkOpacity: 0.16,
        width,
      });
      const changeText = '+18456 (+17.58%)';
      const changeCommandIndex = scene.commands.findIndex(
        (command) => command.kind === 'text' && command.text === changeText,
      );
      const changeCommand = scene.commands[changeCommandIndex];
      const clipCommand = scene.commands
        .slice(0, changeCommandIndex)
        .findLast((command) => command.kind === 'clip');

      expect(changeCommand).toMatchObject({ kind: 'text', text: changeText });
      expect(clipCommand).toMatchObject({ kind: 'clip' });
      if (changeCommand?.kind === 'text' && clipCommand?.kind === 'clip') {
        expect(
          changeCommand.x + changeCommand.text.length * 6,
        ).toBeLessThanOrEqual(clipCommand.rect.x + clipCommand.rect.width);
      }
    }
  });

  it('keeps scene command count bounded for long histories', () => {
    const buildScene = (points: IMarketTokenKLineDataPoint[]) =>
      buildTradingViewNativeChartScene({
        candleIntervalSeconds: 3600,
        chartType: 'candlestick',
        crosshair: { visible: false, x: 0, y: 0 },
        hasVolume: true,
        height: 240,
        measureTextWidth: (text) => text.length * 6,
        candleLabels: CANDLE_LABELS,
        points,
        viewport: { offset: 0, zoomScale: 1 },
        watermarkOpacity: 0.16,
        width: 320,
      });
    const shortScene = buildScene(buildLinearPoints(200));
    const longScene = buildScene(buildLinearPoints(10_000));

    expect(longScene.visiblePointRange.endIndex).toBe(10_000);
    expect(
      longScene.visiblePointRange.endIndex -
        longScene.visiblePointRange.startIndex,
    ).toBeLessThan(100);
    expect(longScene.commands.length).toBeLessThanOrEqual(
      shortScene.commands.length + 10,
    );
  });

  it('renders selected volume in its own pane without main-chart volume', () => {
    const points = buildLinearPoints(80).map((point, index) => ({
      ...point,
      v: 1000 + index * 10,
    }));
    const subIndicatorPanes =
      createTradingViewNativeSubIndicatorRenderSnapshots({
        configs: [
          { id: 'VOL', indicator: 'VOL' },
          { id: 'MACD', indicator: 'MACD' },
          { id: 'RSI', indicator: 'RSI' },
          { id: 'MFI', indicator: 'MFI' },
        ],
        points,
      }).map(({ pane }) => pane);
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: true, x: 260, y: 300 },
      hasVolume: false,
      height: 360,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points,
      subIndicatorPanes,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.08,
      width: 320,
    });

    expect(
      scene.commands.some(
        (command) =>
          command.kind === 'rect' &&
          command.customPaintId?.includes(':series:volume'),
      ),
    ).toBe(true);
    expect(
      scene.commands.some(
        (command) =>
          'paint' in command &&
          (command.paint === 'upVolume' || command.paint === 'downVolume'),
      ),
    ).toBe(false);
    expect(
      scene.commands.some(
        (command) => command.kind === 'text' && command.text === 'VOL',
      ),
    ).toBe(true);
    expect(
      Object.keys(scene.customPaintStyles).some((key) =>
        key.includes(':series:volume:palette:'),
      ),
    ).toBe(true);
    const watermark = scene.commands.find(
      (command) => command.kind === 'watermark',
    );
    if (watermark?.kind === 'watermark') {
      expect(watermark.rect.y + watermark.rect.height).toBeLessThanOrEqual(
        360 - 24 - 4 * 56,
      );
    }
  });

  it('uses the supplied price-axis font size for vertical label baselines', () => {
    const buildScene = (priceAxisFontSize?: number) =>
      buildTradingViewNativeChartScene({
        candleIntervalSeconds: 3600,
        chartType: 'candlestick',
        crosshair: { visible: false, x: 0, y: 0 },
        hasVolume: false,
        height: 240,
        measureTextWidth: (text) => text.length * 6,
        candleLabels: CANDLE_LABELS,
        points: POINTS,
        priceAxisFontSize,
        viewport: { offset: 0, zoomScale: 1 },
        watermarkOpacity: 0.16,
        width: 320,
      });
    const getFirstPriceTickY = (
      scene: ReturnType<typeof buildTradingViewNativeChartScene>,
    ) => {
      const command = scene.commands.find(
        (candidate) =>
          candidate.kind === 'text' &&
          candidate.font === 'priceAxis' &&
          candidate.paint === 'axisText',
      );
      return command?.kind === 'text' ? command.y : undefined;
    };

    const defaultY = getFirstPriceTickY(buildScene());
    const compactY = getFirstPriceTickY(buildScene(11));

    expect(defaultY).toBeDefined();
    expect(compactY).toBeDefined();
    expect((defaultY ?? 0) - (compactY ?? 0)).toBeCloseTo(0.5);
  });

  it('uses the supplied time-axis font size for horizontal label baselines', () => {
    const buildScene = (timeAxisFontSize?: number) =>
      buildTradingViewNativeChartScene({
        candleIntervalSeconds: 3600,
        chartType: 'candlestick',
        crosshair: { visible: false, x: 0, y: 0 },
        hasVolume: false,
        height: 240,
        measureTextWidth: (text) => text.length * 6,
        candleLabels: CANDLE_LABELS,
        points: POINTS,
        timeAxisFontSize,
        viewport: { offset: 0, zoomScale: 1 },
        watermarkOpacity: 0.16,
        width: 320,
      });
    const getFirstTimeTickY = (
      scene: ReturnType<typeof buildTradingViewNativeChartScene>,
    ) => {
      const command = scene.commands.find(
        (candidate) =>
          candidate.kind === 'text' &&
          candidate.font === 'axis' &&
          candidate.paint === 'axisText',
      );
      return command?.kind === 'text' ? command.y : undefined;
    };

    const defaultY = getFirstTimeTickY(buildScene());
    const compactY = getFirstTimeTickY(buildScene(11));

    expect(defaultY).toBeDefined();
    expect(compactY).toBeDefined();
    expect((defaultY ?? 0) - (compactY ?? 0)).toBeCloseTo(0.5);
  });

  it('uses the supplied compact time-axis height', () => {
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: false, x: 0, y: 0 },
      extendTimeAxisBorderToCanvasEdge: true,
      hasVolume: false,
      height: 240,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: POINTS,
      timeAxisHeight: 20,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.16,
      width: 320,
    });
    const timeAxisBorder = scene.commands.find(
      (command) => command.kind === 'line' && command.paint === 'gridSolidLine',
    );

    expect(timeAxisBorder).toMatchObject({
      x1: 0,
      x2: 320,
      y1: 220,
      y2: 220,
    });
  });

  it('clips price extrema markers at the sub-indicator boundary', () => {
    const subIndicatorPanes =
      createTradingViewNativeSubIndicatorRenderSnapshots({
        configs: [{ id: 'RSI', indicator: 'RSI' }],
        points: POINTS,
      }).map(({ pane }) => pane);
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: false,
      height: 240,
      measureTextWidth: (text) => text.length * 6,
      candleLabels: CANDLE_LABELS,
      points: POINTS,
      priceRangeScale: 0.9,
      subIndicatorPanes,
      viewport: { offset: 0, zoomScale: 1 },
      watermarkOpacity: 0.08,
      width: 320,
    });
    const lowMarkerIndex = scene.commands.findIndex(
      (command) =>
        command.kind === 'text' &&
        command.font === 'legend' &&
        command.text === '97.00',
    );
    const lowMarker = scene.commands[lowMarkerIndex];
    const extremaClip = scene.commands
      .slice(0, lowMarkerIndex)
      .findLast((command) => command.kind === 'clip');

    expect(lowMarker).toMatchObject({ kind: 'text', text: '97.00' });
    expect(extremaClip).toEqual({
      kind: 'clip',
      rect: { height: 160, width: 320, x: 0, y: 0 },
    });
    if (lowMarker?.kind === 'text' && extremaClip?.kind === 'clip') {
      expect(lowMarker.y).toBeGreaterThan(extremaClip.rect.height);
    }
    expect(scene.commands[lowMarkerIndex + 1]).toEqual({ kind: 'restore' });
  });
});
