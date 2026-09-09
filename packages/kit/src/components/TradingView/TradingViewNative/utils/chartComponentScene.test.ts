import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { TRADING_VIEW_NATIVE_REFERENCE_LINE_LABEL_SEPARATOR_WIDTH } from '../chartConstants';

import { buildTradingViewNativeChartScene } from './chartScene';

const POINTS: IMarketTokenKLineDataPoint[] = [
  { c: 101, h: 103, l: 98, o: 100, t: 1_700_000_000, v: 10 },
  { c: 99, h: 102, l: 97, o: 101, t: 1_700_003_600, v: 20 },
  { c: 104, h: 105, l: 98, o: 99, t: 1_700_007_200, v: 15 },
];
const CANDLE_LABELS = { close: 'C', high: 'H', low: 'L', open: 'O' };

describe('TradingViewNative chart component scene', () => {
  it('layers text, current price, reference price, and lines in that order', () => {
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartComponents: [
        {
          id: 'initial-price',
          props: {
            anchor: { price: 104, type: 'price' },
            color: '#888888',
            interactive: false,
            style: 'dashed',
            title: 'Prev close',
          },
          type: 'referenceLine',
        },
        {
          id: 'solid-line',
          props: {
            anchor: { price: 101, type: 'price' },
            color: '#777777',
            interactive: false,
            style: 'solid',
            title: 'Support',
          },
          type: 'referenceLine',
        },
      ],
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
    const linePaintId = 'chart.component.referenceLine.initial-price.line';
    const textPaintId = 'chart.component.referenceLine.initial-price.text';
    const solidLinePaintId = 'chart.component.referenceLine.solid-line.line';

    expect(scene.customPaintStyles[linePaintId]).toMatchObject({
      color: '#888888',
      dash: [4, 3],
      opacity: 1,
    });
    expect(scene.customPaintStyles[solidLinePaintId]).toMatchObject({
      color: '#777777',
      dash: undefined,
      opacity: 1,
    });
    expect(
      scene.commands.some(
        (command) =>
          command.kind === 'line' && command.customPaintId === solidLinePaintId,
      ),
    ).toBe(true);
    const referenceLineIndex = scene.commands.findIndex(
      (command) =>
        command.kind === 'line' && command.customPaintId === linePaintId,
    );
    const latestPriceLineIndex = scene.commands.findIndex(
      (command) =>
        command.kind === 'line' && command.paint === 'upCurrentPriceLine',
    );
    const titleIndex = scene.commands.findIndex(
      (command) => command.kind === 'text' && command.text === 'Prev close',
    );
    const priceLabelIndex = scene.commands.findIndex(
      (command) =>
        command.kind === 'text' &&
        command.customPaintId === textPaintId &&
        command.text === '104.00',
    );
    const currentPriceLabelIndex = scene.commands.findIndex(
      (command) =>
        command.kind === 'text' &&
        command.customPaintId === undefined &&
        command.paint === 'currentPriceLabelText' &&
        command.text === '104.00',
    );

    expect(referenceLineIndex).toBeGreaterThanOrEqual(0);
    expect(referenceLineIndex).toBeLessThan(latestPriceLineIndex);
    expect(latestPriceLineIndex).toBeLessThan(priceLabelIndex);
    expect(titleIndex).toBeGreaterThan(latestPriceLineIndex);
    expect(priceLabelIndex).toBeLessThan(currentPriceLabelIndex);
    expect(titleIndex).toBeGreaterThan(currentPriceLabelIndex);
    const titleTextXs = scene.commands.flatMap((command) =>
      command.kind === 'text' && command.text === 'Prev close'
        ? [command.x]
        : [],
    );
    const priceLabelXs = scene.commands.flatMap((command) =>
      command.kind === 'text' &&
      command.customPaintId === textPaintId &&
      command.text === '104.00'
        ? [command.x]
        : [],
    );
    const labelRects = scene.commands.flatMap((command) =>
      command.kind === 'rect' &&
      command.customPaintId ===
        'chart.component.referenceLine.initial-price.label'
        ? [command]
        : [],
    );
    const titleRect = labelRects.find(
      (rect) => rect.x < 320 - scene.priceAxisWidth,
    );
    const labelSeparators = scene.commands.flatMap((command) =>
      command.kind === 'rect' &&
      command.paint === 'background' &&
      command.x ===
        320 -
          scene.priceAxisWidth -
          TRADING_VIEW_NATIVE_REFERENCE_LINE_LABEL_SEPARATOR_WIDTH &&
      command.width ===
        TRADING_VIEW_NATIVE_REFERENCE_LINE_LABEL_SEPARATOR_WIDTH &&
      command.y === titleRect?.y
        ? [command]
        : [],
    );
    expect(titleTextXs).toHaveLength(1);
    expect(titleTextXs[0]).toBeLessThan(320 - scene.priceAxisWidth);
    expect(priceLabelXs).toHaveLength(1);
    expect(priceLabelXs[0]).toBeGreaterThanOrEqual(320 - scene.priceAxisWidth);
    expect(titleRect ? titleRect.x + titleRect.width : undefined).toBe(
      320 -
        scene.priceAxisWidth -
        TRADING_VIEW_NATIVE_REFERENCE_LINE_LABEL_SEPARATOR_WIDTH,
    );
    expect(labelSeparators).toHaveLength(1);
    expect(labelSeparators[0]).toMatchObject({
      height: titleRect?.height,
      y: titleRect?.y,
    });
  });

  it('does not extend auto scale to an off-screen reference line', () => {
    const linePaintId = 'chart.component.referenceLine.off-screen-price.line';
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: 3600,
      chartComponents: [
        {
          id: 'off-screen-price',
          props: {
            anchor: { price: 1000, type: 'price' },
            color: '#888888',
            interactive: false,
            style: 'solid',
            title: '',
          },
          type: 'referenceLine',
        },
      ],
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

    expect(scene.customPaintStyles[linePaintId]).toBeUndefined();
    expect(
      scene.commands.some(
        (command) =>
          'customPaintId' in command && command.customPaintId === linePaintId,
      ),
    ).toBe(false);
  });
});
