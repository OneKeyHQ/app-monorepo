import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import { createTradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import {
  TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
  TRADING_VIEW_NATIVE_PREVIOUS_CLOSE_REFERENCE_LINE_ID,
  TRADING_VIEW_NATIVE_REFERENCE_LINE_LABEL_SEPARATOR_WIDTH,
} from '../chartConstants';

import { getTradingViewNativeChartLayout } from './chartLayout';
import {
  type IBuildTradingViewNativeChartSceneOptions,
  buildTradingViewNativeChartScene,
} from './chartScene';

const POINTS: IMarketTokenKLineDataPoint[] = [
  { c: 101, h: 103, l: 98, o: 100, t: 1_700_000_000, v: 10 },
  { c: 99, h: 102, l: 97, o: 101, t: 1_700_003_600, v: 20 },
  { c: 104, h: 105, l: 98, o: 99, t: 1_700_007_200, v: 15 },
];
const CANDLE_LABELS = { close: 'C', high: 'H', low: 'L', open: 'O' };
const PREVIOUS_CLOSE_PAINT_ID = `chart.component.referenceLine.${TRADING_VIEW_NATIVE_PREVIOUS_CLOSE_REFERENCE_LINE_ID}`;

function buildPreviousCloseScene(
  previousClose: number,
  overrides: Partial<IBuildTradingViewNativeChartSceneOptions> = {},
) {
  return buildTradingViewNativeChartScene({
    candleIntervalSeconds: 3600,
    chartComponents: [
      {
        id: TRADING_VIEW_NATIVE_PREVIOUS_CLOSE_REFERENCE_LINE_ID,
        props: {
          anchor: { price: previousClose, type: 'price' },
          color: '#888888',
          interactive: false,
          style: 'dashed',
          title: 'Prev close',
        },
        type: 'referenceLine',
      },
    ],
    chartType: 'area',
    crosshair: { visible: false, x: 0, y: 0 },
    hasVolume: false,
    height: 240,
    measureTextWidth: (text) => text.length * 6,
    candleLabels: CANDLE_LABELS,
    points: POINTS,
    pinnedPriceRange: { minPrice: 90, maxPrice: 110 },
    priceAxisWidth: 80,
    viewport: { offset: 0, zoomScale: 1 },
    watermarkOpacity: 0.16,
    width: 320,
    ...overrides,
  });
}

describe('TradingViewNative chart component scene', () => {
  it.each<{
    previousClose: number;
    position: 'above' | 'below';
    minPrice?: number;
    maxPrice?: number;
    hasVolume?: boolean;
    height?: number;
    labelSpacing?: number;
  }>([
    { previousClose: 103.5, position: 'below' },
    { previousClose: 104, position: 'above' },
    { previousClose: 104.5, position: 'above' },
    { previousClose: 104, position: 'above', maxPrice: 104 },
    { previousClose: 104.1, position: 'above', maxPrice: 104.1 },
    { previousClose: 103.9, position: 'below', maxPrice: 104 },
    { previousClose: 104, position: 'above', minPrice: 104 },
    { previousClose: 104.1, position: 'above', minPrice: 104 },
    { previousClose: 103.9, position: 'below', minPrice: 103.9 },
    {
      previousClose: 103.9,
      position: 'below',
      minPrice: 103.9,
      hasVolume: true,
    },
    {
      previousClose: 104,
      position: 'above',
      maxPrice: 104,
      height: 86,
      labelSpacing: 10,
    },
    {
      previousClose: 103.9,
      position: 'below',
      minPrice: 103.9,
      height: 86,
      labelSpacing: 10,
    },
  ])(
    'docks labels inside the price pane in price order without moving either line: %o',
    ({
      previousClose,
      position,
      minPrice = 90,
      maxPrice = 110,
      hasVolume = false,
      height = 240,
      labelSpacing = 20,
    }) => {
      const overrides = {
        hasVolume,
        height,
        pinnedPriceRange: { minPrice, maxPrice },
      };
      const scene = buildPreviousCloseScene(previousClose, overrides);
      const layout = getTradingViewNativeChartLayout({
        ...overrides,
        candleIntervalSeconds: 3600,
        chartType: 'area',
        minimumTimeTickIndexSpacing: 1,
        points: POINTS,
        priceAxisWidth: 80,
        visiblePointRange: scene.visiblePointRange,
        width: 320,
      });
      expect(layout).not.toBeNull();
      if (!layout) {
        return;
      }
      const chartSettings = createTradingViewNativeChartSettings();
      chartSettings.options.latestPrice = false;
      const withoutCurrentLabel = buildPreviousCloseScene(previousClose, {
        ...overrides,
        chartSettings,
      });
      const currentLabel = scene.commands.flatMap((command) =>
        command.kind === 'rect' && command.paint === 'up' ? [command] : [],
      )[0];
      const referenceLabels = scene.commands.flatMap((command) =>
        command.kind === 'rect' &&
        command.customPaintId === `${PREVIOUS_CLOSE_PAINT_ID}.label`
          ? [command]
          : [],
      );
      expect(currentLabel).toBeDefined();
      expect(referenceLabels).toHaveLength(2);
      for (const label of [currentLabel, ...referenceLabels]) {
        expect(label.y).toBeGreaterThanOrEqual(
          TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
        );
        expect(label.y + label.height).toBeLessThanOrEqual(
          TRADING_VIEW_NATIVE_CHART_TOP_PADDING + layout.priceChartHeight,
        );
      }
      const currentLabelText = scene.commands.flatMap((command) =>
        command.kind === 'text' &&
        command.paint === 'currentPriceLabelText' &&
        command.customPaintId === undefined
          ? [command]
          : [],
      )[0];
      expect(currentLabelText.y).toBeGreaterThan(currentLabel.y);
      expect(currentLabelText.y).toBeLessThan(
        currentLabel.y + currentLabel.height,
      );
      for (const label of referenceLabels) {
        if (position === 'above') {
          expect(label.y + labelSpacing).toBe(currentLabel.y);
        } else {
          expect(label.y).toBe(currentLabel.y + labelSpacing);
        }
      }
      const referenceLine = scene.commands.find(
        (command) =>
          command.kind === 'line' &&
          command.customPaintId === `${PREVIOUS_CLOSE_PAINT_ID}.line`,
      );
      expect(referenceLine).toEqual(
        withoutCurrentLabel.commands.find(
          (command) =>
            command.kind === 'line' &&
            command.customPaintId === `${PREVIOUS_CLOSE_PAINT_ID}.line`,
        ),
      );
      const withoutReference = buildPreviousCloseScene(previousClose, {
        ...overrides,
        chartComponents: [],
      });
      expect(
        scene.commands.find(
          (command) =>
            command.kind === 'line' && command.paint === 'upCurrentPriceLine',
        ),
      ).toEqual(
        withoutReference.commands.find(
          (command) =>
            command.kind === 'line' && command.paint === 'upCurrentPriceLine',
        ),
      );
    },
  );

  it.each([
    { previousClose: 100, latestPrice: true, yAxis: true },
    { previousClose: 104, latestPrice: false, yAxis: true },
    { previousClose: 104, latestPrice: true, yAxis: false },
  ])(
    'keeps the reference label anchored when there is no visible overlap: %o',
    ({ previousClose, latestPrice, yAxis }) => {
      const chartSettings = createTradingViewNativeChartSettings();
      chartSettings.options.latestPrice = latestPrice;
      chartSettings.options.yAxis = yAxis;
      const scene = buildPreviousCloseScene(previousClose, { chartSettings });
      const referenceLine = scene.commands.flatMap((command) =>
        command.kind === 'line' &&
        command.customPaintId === `${PREVIOUS_CLOSE_PAINT_ID}.line`
          ? [command]
          : [],
      )[0];
      const referenceLabels = scene.commands.flatMap((command) =>
        command.kind === 'rect' &&
        command.customPaintId === `${PREVIOUS_CLOSE_PAINT_ID}.label`
          ? [command]
          : [],
      );
      expect(referenceLabels).toHaveLength(yAxis ? 2 : 1);
      for (const label of referenceLabels) {
        expect(label.y + label.height / 2).toBeCloseTo(referenceLine.y1);
      }
    },
  );

  it.each([36, 90])(
    'sizes the reference price to its text with a %s px price axis',
    (priceAxisWidth) => {
      const scene = buildPreviousCloseScene(104, { priceAxisWidth });
      const referenceLabels = scene.commands.flatMap((command) =>
        command.kind === 'rect' &&
        command.customPaintId === `${PREVIOUS_CLOSE_PAINT_ID}.label`
          ? [command]
          : [],
      );
      const [priceLabel, titleLabel] = referenceLabels;
      const currentLabel = scene.commands.flatMap((command) =>
        command.kind === 'rect' && command.paint === 'up' ? [command] : [],
      )[0];
      expect(referenceLabels).toHaveLength(2);
      expect(priceLabel.width).toBe(currentLabel.width);
      expect(priceLabel.x).toBe(currentLabel.x);
      expect(priceLabel.x + priceLabel.width).toBeLessThanOrEqual(320);
      expect(
        titleLabel.x +
          titleLabel.width +
          TRADING_VIEW_NATIVE_REFERENCE_LINE_LABEL_SEPARATOR_WIDTH,
      ).toBe(priceLabel.x);
    },
  );

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
    expect(scene.commands[titleIndex]).toMatchObject({
      font: 'referenceLineLabel',
    });
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
