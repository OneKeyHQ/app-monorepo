import { createTradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import {
  drawTradingViewNativeCanvasScene,
  getTradingViewNativeCanvasFont,
} from './chartCanvasRenderer';
import { drawTradingViewNativeCanvasChart } from './drawTradingViewNativeCanvasChart';

import type {
  ITradingViewNativeChartSceneCommand,
  ITradingViewNativeChartScenePaintStyle,
} from '../utils/chartScene';

function createCanvasContext() {
  const gradient = { addColorStop: jest.fn() };
  return {
    arc: jest.fn(),
    beginPath: jest.fn(),
    clearRect: jest.fn(),
    clip: jest.fn(),
    closePath: jest.fn(),
    createLinearGradient: jest.fn(() => gradient),
    drawImage: jest.fn(),
    fill: jest.fn(),
    fillRect: jest.fn(),
    fillStyle: '',
    fillText: jest.fn(),
    font: '',
    globalAlpha: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    lineTo: jest.fn(),
    lineWidth: 1,
    measureText: jest.fn((_text: string) => ({ width: 6 })),
    moveTo: jest.fn(),
    rect: jest.fn(),
    restore: jest.fn(),
    save: jest.fn(),
    setLineDash: jest.fn(),
    setTransform: jest.fn(),
    stroke: jest.fn(),
    strokeRect: jest.fn(),
    strokeStyle: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    gradient,
  };
}

const colors = {
  axisText: '#999999',
  background: '#000000',
  grid: '#222222',
  line: '#ffffff',
};

describe('TradingViewNative web canvas scene renderer', () => {
  it.each([
    { width: 840, closeX: 185, closeY: 13 },
    { width: 300, closeX: 185, closeY: 13 },
    { width: 295, closeX: 8, closeY: 28 },
  ])(
    'keeps same-length OHLC digits in stable slots at width $width',
    ({ width, closeX, closeY }) => {
      const chartSettings = createTradingViewNativeChartSettings();
      chartSettings.options.priceChange = false;
      const renderPrices = (open: number) => {
        const context = createCanvasContext();
        context.measureText.mockImplementation((text: string) => ({
          width: text.length * 6 - (text.match(/11/g)?.length ?? 0),
        }));
        const canvas = {
          getBoundingClientRect: () => ({ width, height: 400 }),
          getContext: () => context,
        } as unknown as HTMLCanvasElement;
        const scene = drawTradingViewNativeCanvasChart({
          candleIntervalSeconds: 3600,
          candleLabels: { open: 'O', high: 'H', low: 'L', close: 'C' },
          canvas,
          chartComponents: [],
          chartSettings,
          chartType: 'candlestick',
          colors,
          currentPriceLabel: '80310.1',
          extendTimeAxisBorderToCanvasEdge: false,
          hasVolume: false,
          indicatorSeries: [
            {
              indicator: 'MA',
              key: 'ma11',
              kind: 'line',
              legendLabel: 'MA11',
              paint: 'indicatorOrangeStroke',
              style: {
                color: '#ffffff',
                lineStyle: 'solid',
                lineWidth: 1,
                opacity: 1,
              },
              values: [80_310.1],
            },
          ],
          isMobileLayout: false,
          pinnedPriceRange: null,
          points: [
            {
              o: open,
              h: 82_000.1,
              l: 79_000.1,
              c: 80_310.1,
              t: 1_700_000_000,
              v: 10,
            },
          ],
          priceAxisFontSize: 11,
          priceAxisWidth: 60,
          priceDecimalPlaces: 1,
          priceRangeScale: 1,
          priceScaleMode: 'linear',
          runtimeState: {
            crosshair: { visible: false, x: 0, y: 0 },
            viewport: { offset: 0, zoomScale: 1 },
          },
          showLegend: true,
          subIndicatorPanes: [],
          timeAxisFontSize: 12,
          timeAxisHeight: 28,
          watermarkImage: null,
          watermarkOpacity: 0,
        });
        return { context, commands: scene?.commands ?? [] };
      };
      for (const open of [81_111.1, 80_888.1]) {
        const { commands, context } = renderPrices(open);
        const labels = commands.flatMap((command) =>
          command.kind === 'text' &&
          command.font === 'legend' &&
          ['O', 'H', 'L', 'C'].includes(command.text)
            ? [{ text: command.text, x: command.x, y: command.y }]
            : [],
        );
        expect(labels).toEqual([
          { text: 'O', x: 8, y: 13 },
          { text: 'H', x: 67, y: 13 },
          { text: 'L', x: 126, y: 13 },
          { text: 'C', x: closeX, y: closeY },
        ]);
        expect(context.fillText).toHaveBeenCalledWith(`${open}`, 17, 13);
        const indicatorValue = commands.find(
          (command) =>
            command.kind === 'text' &&
            command.customPaintId &&
            command.text === '80310.1',
        );
        expect(indicatorValue).toMatchObject({ x: 34 });
      }
    },
  );

  it.each(['B', 'S'] as const)(
    'preserves the existing %s label font and position on web',
    (label) => {
      const context = createCanvasContext();

      drawTradingViewNativeCanvasScene({
        colors,
        commands: [
          {
            kind: 'tradeMarkLabel',
            label,
            cx: 50,
            cy: 30,
            customPaintId: 'chart.tradeMarks.text',
            paint: 'currentPriceLabelText',
          },
        ],
        context: context as unknown as CanvasRenderingContext2D,
        customPaintStyles: {
          'chart.tradeMarks.text': { color: '#FFFFFF', opacity: 1 },
        },
        watermarkImage: null,
      });

      expect(context.fillText).toHaveBeenCalledWith(label, 47, 33.85);
      expect(context.font).toBe('11px sans-serif');
      expect(context.fillStyle).toBe('#FFFFFF');
      expect(context.save).toHaveBeenCalledTimes(1);
      expect(context.restore).toHaveBeenCalledTimes(1);
    },
  );

  it('uses a regular sans-serif font for price-axis and reference labels on web', () => {
    expect(getTradingViewNativeCanvasFont('priceAxis', 14)).toBe(
      '14px sans-serif',
    );
    expect(getTradingViewNativeCanvasFont('referenceLineLabel', 14)).toBe(
      '14px sans-serif',
    );
  });

  it('uses custom paint styles before the semantic fallback', () => {
    const context = createCanvasContext();
    const commands: ITradingViewNativeChartSceneCommand[] = [
      {
        customPaintId: 'pane.line',
        kind: 'line',
        paint: 'gridLine',
        x1: 1,
        x2: 3,
        y1: 2,
        y2: 4,
      },
    ];
    const customPaintStyles: Record<
      string,
      ITradingViewNativeChartScenePaintStyle
    > = {
      'pane.line': {
        color: '#123456',
        dash: [3, 2],
        opacity: 0.4,
        strokeWidth: 2,
      },
    };

    drawTradingViewNativeCanvasScene({
      colors,
      commands,
      context: context as unknown as CanvasRenderingContext2D,
      customPaintStyles,
      watermarkImage: null,
    });

    expect(context.strokeStyle).toBe('#123456');
    expect(context.globalAlpha).toBe(0.4);
    expect(context.lineWidth).toBe(2);
    expect(context.setLineDash).toHaveBeenCalledWith([3, 2]);
    expect(context.stroke).toHaveBeenCalledTimes(1);
  });

  it('falls back to semantic paint when a custom ID is unavailable', () => {
    const context = createCanvasContext();
    const commands: ITradingViewNativeChartSceneCommand[] = [
      {
        customPaintId: 'missing.paint',
        kind: 'line',
        paint: 'gridSolidLine',
        x1: 1,
        x2: 3,
        y1: 2,
        y2: 4,
      },
    ];

    drawTradingViewNativeCanvasScene({
      colors,
      commands,
      context: context as unknown as CanvasRenderingContext2D,
      customPaintStyles: {},
      watermarkImage: null,
    });

    expect(context.strokeStyle).toBe(colors.grid);
  });

  it('closes and fills polygon commands', () => {
    const context = createCanvasContext();
    const commands: ITradingViewNativeChartSceneCommand[] = [
      {
        customPaintId: 'pane.fill',
        kind: 'polygon',
        paint: 'background',
        points: [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
          { x: 5, y: 2 },
        ],
      },
    ];

    drawTradingViewNativeCanvasScene({
      colors,
      commands,
      context: context as unknown as CanvasRenderingContext2D,
      customPaintStyles: {
        'pane.fill': {
          color: '#abcdef',
          opacity: 0.25,
        },
      },
      watermarkImage: null,
    });

    expect(context.moveTo).toHaveBeenCalledWith(1, 2);
    expect(context.lineTo).toHaveBeenNthCalledWith(1, 3, 4);
    expect(context.lineTo).toHaveBeenNthCalledWith(2, 5, 2);
    expect(context.closePath).toHaveBeenCalledTimes(1);
    expect(context.fillStyle).toBe('#abcdef');
    expect(context.fill).toHaveBeenCalledTimes(1);
  });

  it('preserves nested clip and restore commands', () => {
    const context = createCanvasContext();
    const commands: ITradingViewNativeChartSceneCommand[] = [
      {
        kind: 'clip',
        rect: { height: 20, width: 30, x: 1, y: 2 },
      },
      {
        height: 4,
        kind: 'rect',
        paint: 'background',
        width: 3,
        x: 1,
        y: 2,
      },
      { kind: 'restore' },
    ];

    drawTradingViewNativeCanvasScene({
      colors,
      commands,
      context: context as unknown as CanvasRenderingContext2D,
      customPaintStyles: {},
      watermarkImage: null,
    });

    expect(context.rect).toHaveBeenCalledWith(1, 2, 30, 20);
    expect(context.clip).toHaveBeenCalledTimes(1);
    expect(context.save).toHaveBeenCalledTimes(2);
    expect(context.restore).toHaveBeenCalledTimes(2);
  });

  it('draws gradient backgrounds and stroked candle borders', () => {
    const context = createCanvasContext();
    const commands: ITradingViewNativeChartSceneCommand[] = [
      {
        colors: ['#010203', '#040506'],
        kind: 'linearGradientRect',
        rect: { height: 20, width: 30, x: 1, y: 2 },
      },
      {
        customPaintId: 'candle.border',
        height: 10,
        kind: 'rect',
        paint: 'up',
        width: 4,
        x: 5,
        y: 6,
      },
    ];

    drawTradingViewNativeCanvasScene({
      colors,
      commands,
      context: context as unknown as CanvasRenderingContext2D,
      customPaintStyles: {
        'candle.border': {
          color: '#123456',
          drawStyle: 'stroke',
          opacity: 1,
          strokeWidth: 2,
        },
      },
      watermarkImage: null,
    });

    expect(context.createLinearGradient).toHaveBeenCalledWith(1, 2, 1, 22);
    expect(context.gradient.addColorStop).toHaveBeenNthCalledWith(
      1,
      0,
      '#010203',
    );
    expect(context.gradient.addColorStop).toHaveBeenNthCalledWith(
      2,
      1,
      '#040506',
    );
    expect(context.strokeRect).toHaveBeenCalledWith(5, 6, 4, 10);
    expect(context.strokeStyle).toBe('#123456');
    expect(context.lineWidth).toBe(2);
  });
});
