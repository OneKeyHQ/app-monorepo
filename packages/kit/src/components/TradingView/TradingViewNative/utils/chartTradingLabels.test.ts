import {
  TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
  TRADING_VIEW_NATIVE_TRADING_LINE_LABEL_HEIGHT,
} from '../chartConstants';

import { appendTradingViewNativeChartComponentCommands } from './chartComponentScene';

import type {
  ITradingViewNativeChartSceneCommand,
  ITradingViewNativeChartScenePaintStyle,
} from './chartScene';
import type { ITradingViewNativeReferenceLineComponent } from '../types';

function buildLabels(
  prices: number[],
  priceChartHeight = 200,
  pending?: ITradingViewNativeReferenceLineComponent['props']['pending'],
) {
  const components: ITradingViewNativeReferenceLineComponent[] = prices.map(
    (price, index) => ({
      id: `order-${index}`,
      type: 'referenceLine',
      props: {
        anchor: { type: 'price', price },
        color: '#00aa00',
        interactive: true,
        cancelable: true,
        draggable: true,
        pending: index === 0 ? pending : undefined,
        style: 'dotted',
        title: `Limit ${price}`,
        label: {
          variant: 'order',
          offset: 16,
          backgroundColor: '#111111',
          color: '#00aa00',
        },
      },
    }),
  );
  const commands: ITradingViewNativeChartSceneCommand[] = [];
  const customPaintStyles: Record<
    string,
    ITradingViewNativeChartScenePaintStyle
  > = {};
  const layers = appendTradingViewNativeChartComponentCommands({
    commands,
    components,
    customPaintStyles,
    drawings: [],
    maxPrice: 110,
    minPrice: 90,
    measureTextWidth: (text) => text.length * 6,
    priceAxisFontSize: 12,
    priceAxisX: 600,
    priceChartHeight,
    priceScaleMode: 'linear',
    showYAxis: true,
    width: 680,
  });
  const labels = layers.textLabelCommands.flatMap((command) =>
    command.kind === 'rect' && command.customPaintId?.endsWith('.trading.body')
      ? [command]
      : [],
  );
  return { ...layers, commands, customPaintStyles, labels };
}

describe('trading labels', () => {
  it('replaces cancellation with a loading indicator without fading the label', () => {
    const { labels, customPaintStyles, hitRegions, textLabelCommands } =
      buildLabels([104, 100], 200, 'cancel');
    expect(
      customPaintStyles[
        'chart.component.referenceLine.order-0.label.trading.body'
      ].opacity,
    ).toBe(1);
    const loading = hitRegions.find(
      (hit) => hit.id === 'order-0' && hit.action === 'cancel',
    );
    expect(loading).toMatchObject({
      loadingColor: '#00aa00',
      rect: { y: labels[0].y, height: labels[0].height },
    });
    expect(
      hitRegions.some((hit) => hit.id === 'order-0' && !hit.disabled),
    ).toBe(false);
    expect(
      hitRegions.find((hit) => hit.id === 'order-1' && hit.action === 'cancel')
        ?.loadingColor,
    ).toBeUndefined();
    expect(
      textLabelCommands.filter(
        (command) =>
          command.kind === 'line' &&
          command.customPaintId ===
            'chart.component.referenceLine.order-0.label.trading.bodyText',
      ),
    ).toEqual([]);
  });

  it('keeps amendment previews distinct from cancellation loading', () => {
    const { customPaintStyles, hitRegions } = buildLabels(
      [104],
      200,
      'priceChange',
    );
    expect(
      customPaintStyles[
        'chart.component.referenceLine.order-0.label.trading.body'
      ].opacity,
    ).toBe(0.5);
    expect(hitRegions).toHaveLength(2);
    expect(hitRegions.every((hit) => hit.disabled)).toBe(true);
  });
  it.each([
    [104, 103.9, 103.8],
    [100, 100, 100],
    [110, 109.99, 109.98],
    [90.02, 90.01, 90],
  ])('keeps nearby labels separate and inside the chart: %j', (...prices) => {
    const { labels, hitRegions, commands } = buildLabels(prices);
    expect(labels).toHaveLength(3);
    const ordered = labels.toSorted((left, right) => left.y - right.y);
    ordered.forEach((label, index) => {
      expect(label.y).toBeGreaterThanOrEqual(
        TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
      );
      expect(label.y + label.height).toBeLessThanOrEqual(
        TRADING_VIEW_NATIVE_CHART_TOP_PADDING + 200,
      );
      if (index > 0)
        expect(label.y - ordered[index - 1].y).toBeGreaterThanOrEqual(
          TRADING_VIEW_NATIVE_TRADING_LINE_LABEL_HEIGHT,
        );
    });
    prices.forEach((price, index) => {
      const label = labels[index];
      expect(
        commands.find(
          (command) =>
            command.kind === 'line' &&
            command.customPaintId ===
              `chart.component.referenceLine.order-${index}.line`,
        ),
      ).toMatchObject({
        y1: TRADING_VIEW_NATIVE_CHART_TOP_PADDING + (110 - price) * 10,
      });
      expect(
        hitRegions.find(
          (hit) => hit.id === `order-${index}` && hit.action === 'cancel',
        ),
      ).toMatchObject({
        price,
        rect: { y: label.y, height: label.height },
      });
      for (const [x, action] of [
        [label.x + 10, 'drag'],
        [label.x + label.width - 10, 'cancel'],
      ] as const) {
        const y = label.y + label.height / 2;
        expect(
          hitRegions.findLast(
            ({ rect }) =>
              x >= rect.x &&
              x <= rect.x + rect.width &&
              y >= rect.y &&
              y <= rect.y + rect.height,
          ),
        ).toMatchObject({ id: `order-${index}`, action });
      }
    });
  });
});
