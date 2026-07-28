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
      expect.arrayContaining(['O', 'H', 'L', 'C', 'Volume']),
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

  it('maps semantic paints to the same platform-neutral colors', () => {
    const styles = getTradingViewNativeChartScenePaintStyles({
      axisText: '#111111',
      background: '#222222',
      grid: '#333333',
    });

    expect(styles.up.color).toBe(TRADING_VIEW_NATIVE_CHART_UP_COLOR);
    expect(styles.down.color).toBe(TRADING_VIEW_NATIVE_CHART_DOWN_COLOR);
    expect(styles.gridLine.dash).toEqual([2, 4]);
    expect(styles.crosshairLine.opacity).toBe(0.6);
  });

  it('keeps scene command count bounded for long histories', () => {
    const buildScene = (points: IMarketTokenKLineDataPoint[]) =>
      buildTradingViewNativeChartScene({
        candleIntervalSeconds: 3600,
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
