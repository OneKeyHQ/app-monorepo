import { drawTradingViewNativeCanvasScene } from './chartCanvasRenderer';

import type {
  ITradingViewNativeChartSceneCommand,
  ITradingViewNativeChartScenePaintStyle,
} from '../utils/chartScene';

function createCanvasContext() {
  const gradient = { addColorStop: jest.fn() };
  return {
    arc: jest.fn(),
    beginPath: jest.fn(),
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
    moveTo: jest.fn(),
    rect: jest.fn(),
    restore: jest.fn(),
    save: jest.fn(),
    setLineDash: jest.fn(),
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
