import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CHART_DOWN_COLOR,
  TRADING_VIEW_NATIVE_CHART_UP_COLOR,
  TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
} from '../chartConstants';

import {
  buildTradingViewNativeChartScene,
  getTradingViewNativeChartScenePaintStyles,
} from './chartScene';

const POINTS: IMarketTokenKLineDataPoint[] = [
  { c: 101, h: 103, l: 98, o: 100, t: 1_700_000_000, v: 10 },
  { c: 99, h: 102, l: 97, o: 101, t: 1_700_003_600, v: 20 },
  { c: 104, h: 105, l: 98, o: 99, t: 1_700_007_200, v: 15 },
];

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
      crosshair: { visible: true, x: 252.5, y: 80 },
      height: 240,
      measureTextWidth: (text) => text.length * 6,
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
  });

  it('normalizes invalid viewport bounds before producing commands', () => {
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: false, x: 0, y: 0 },
      height: 240,
      measureTextWidth: () => 0,
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

  it('omits empty volume and keeps small positive volume visible', () => {
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartType: 'candlestick',
      crosshair: { visible: false, x: 0, y: 0 },
      height: 240,
      measureTextWidth: () => 0,
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
      height: 240,
      measureTextWidth: (text) => text.length * 6,
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
        height: 240,
        measureTextWidth: (text) => text.length * 6,
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
        height: 240,
        measureTextWidth: (text) => text.length * 6,
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
});
