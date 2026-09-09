import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
  TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE,
} from '../chartConstants';

import { getTradingViewNativePriceY } from './chartLayout';

import type { ITradingViewNativeChartRuntimeCrosshair } from './chartRuntime';
import type {
  ITradingViewNativeChartSceneCommand,
  ITradingViewNativeChartSceneFont,
  ITradingViewNativeChartScenePaintStyle,
} from './chartScene';
import type {
  ITradingViewNativeChartLeafComponent,
  ITradingViewNativePriceScaleMode,
} from '../types';

const MARK_SIZE = 14;
const MARK_RADIUS = MARK_SIZE / 2;
const MAX_MARKS_PER_BAR = 10;
const BUY_PAINT_ID = 'chart.tradeMarks.buy';
const SELL_PAINT_ID = 'chart.tradeMarks.sell';
const TEXT_PAINT_ID = 'chart.tradeMarks.text';

export function getTradingViewNativeTradeMarkPointIndex({
  points,
  timestamp,
  candleIntervalSeconds,
}: {
  points: readonly IMarketTokenKLineDataPoint[];
  timestamp: number;
  candleIntervalSeconds: number;
}): number | null {
  'worklet';

  if (!Number.isFinite(timestamp) || candleIntervalSeconds <= 0) {
    return null;
  }
  const time = timestamp > 1e10 ? Math.floor(timestamp / 1000) : timestamp;
  let left = 0;
  let right = points.length;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (points[middle].t <= time) {
      left = middle + 1;
    } else {
      right = middle;
    }
  }
  const index = left - 1;
  const point = points[index];
  if (!point) {
    return null;
  }
  let end = point.t + candleIntervalSeconds;
  if (candleIntervalSeconds === 30 * 24 * 60 * 60) {
    const date = new Date(point.t * 1000);
    end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000;
  }
  // Do not attach trades in a missing candle to the preceding candle.
  return time < Math.min(end, points[index + 1]?.t ?? end) ? index : null;
}

export interface ITradingViewNativeTradeMarkLayout {
  id: string;
  label: string;
  text: string;
  x: number;
  y: number;
}

function appendTradeMarkTooltip({
  commands,
  mark,
  measureTextWidth,
  priceAxisX,
  priceChartHeight,
}: {
  commands: ITradingViewNativeChartSceneCommand[];
  mark: ITradingViewNativeTradeMarkLayout;
  measureTextWidth: (
    text: string,
    font: ITradingViewNativeChartSceneFont,
  ) => number;
  priceAxisX: number;
  priceChartHeight: number;
}) {
  'worklet';

  const padding = 8;
  const lineHeight = TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE + 5;
  const maxWidth = Math.min(300, priceAxisX - padding * 2);
  const maxLines = Math.min(
    6,
    Math.floor((priceChartHeight - padding * 2) / lineHeight),
  );
  if (maxWidth <= padding * 2 || maxLines < 1) {
    return;
  }
  const lines: string[] = [];
  let line = '';
  for (const character of mark.text) {
    if (
      character === '\n' ||
      measureTextWidth(line + character, 'legend') > maxWidth - padding * 2
    ) {
      lines.push(line);
      line = character === '\n' ? '' : character;
      if (lines.length === maxLines) {
        lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, -1)}…`;
        line = '';
        break;
      }
    } else {
      line += character;
    }
  }
  if (line) {
    lines.push(line);
  }
  const width = Math.min(
    maxWidth,
    Math.max(...lines.map((text) => measureTextWidth(text, 'legend'))) +
      padding * 2,
  );
  const height = lines.length * lineHeight + padding * 2;
  const x = Math.max(
    padding,
    Math.min(mark.x - width / 2, priceAxisX - width - padding),
  );
  const y = Math.max(
    0,
    Math.min(mark.y + MARK_RADIUS + padding, priceChartHeight - height),
  );
  commands.push({
    kind: 'rect',
    x,
    y,
    width,
    height,
    paint: 'crosshairLabelBackground',
  });
  for (let index = 0; index < lines.length; index += 1) {
    commands.push({
      kind: 'text',
      text: lines[index],
      font: 'legend',
      x: x + padding,
      y: y + padding + (index + 1) * lineHeight - 4,
      paint: 'crosshairLabelText',
    });
  }
}

export function appendTradingViewNativeTradeMarkCommands({
  candleIntervalSeconds,
  commands,
  components,
  crosshair,
  customPaintStyles,
  getPointX,
  maxPrice,
  measureTextWidth,
  minPrice,
  points,
  priceAxisX,
  priceChartHeight,
  priceScaleMode,
}: {
  candleIntervalSeconds: number;
  commands: ITradingViewNativeChartSceneCommand[];
  components: readonly ITradingViewNativeChartLeafComponent[];
  crosshair: ITradingViewNativeChartRuntimeCrosshair;
  customPaintStyles: Record<string, ITradingViewNativeChartScenePaintStyle>;
  getPointX: (index: number) => number;
  maxPrice: number;
  measureTextWidth: (
    text: string,
    font: ITradingViewNativeChartSceneFont,
  ) => number;
  minPrice: number;
  points: readonly IMarketTokenKLineDataPoint[];
  priceAxisX: number;
  priceChartHeight: number;
  priceScaleMode: ITradingViewNativePriceScaleMode;
}): ITradingViewNativeTradeMarkLayout[] {
  'worklet';

  const layouts: ITradingViewNativeTradeMarkLayout[] = [];
  const barCounts: Record<number, number> = {};
  const ids = new Set<string>();
  let hoveredMark: ITradingViewNativeTradeMarkLayout | undefined;
  components.forEach((component) => {
    if (component.type !== 'tradeMarks') {
      return;
    }
    component.props.marks.forEach((mark) => {
      if (ids.has(mark.id) || (mark.label !== 'B' && mark.label !== 'S')) {
        return;
      }
      ids.add(mark.id);
      const index = getTradingViewNativeTradeMarkPointIndex({
        candleIntervalSeconds,
        points,
        timestamp: mark.time,
      });
      if (index === null) {
        return;
      }
      const x = getPointX(index);
      const order = barCounts[index] ?? 0;
      barCounts[index] = order + 1;
      if (
        order >= MAX_MARKS_PER_BAR ||
        x + MARK_RADIUS < TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING ||
        x - MARK_RADIUS > priceAxisX
      ) {
        return;
      }
      const candleY = getTradingViewNativePriceY(points[index].h, {
        maxPrice,
        minPrice,
        priceChartHeight,
        priceScaleMode,
      });
      const y = candleY - MARK_SIZE * 1.4 * (order + 0.85);
      if (
        !Number.isFinite(y) ||
        y + MARK_RADIUS < 0 ||
        y - MARK_RADIUS > priceChartHeight
      ) {
        return;
      }
      const layout = { id: mark.id, label: mark.label, text: mark.text, x, y };
      layouts.push(layout);
      const paintId = mark.label === 'B' ? BUY_PAINT_ID : SELL_PAINT_ID;
      customPaintStyles[paintId] = {
        color: mark.label === 'B' ? '#26a69a' : '#ef5350',
        opacity: 1,
      };
      customPaintStyles[TEXT_PAINT_ID] = { color: '#FFFFFF', opacity: 1 };
      commands.push(
        {
          kind: 'clip',
          rect: {
            x: TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
            y: 0,
            width: priceAxisX - TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
            height: priceChartHeight + TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
          },
        },
        {
          kind: 'circle',
          cx: x,
          cy: y,
          radius: MARK_RADIUS,
          customPaintId: paintId,
          paint: 'up',
        },
        {
          kind: 'text',
          text: mark.label,
          font: 'legend',
          x: x - measureTextWidth(mark.label, 'legend') / 2,
          y: y + TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE * 0.35,
          customPaintId: TEXT_PAINT_ID,
          paint: 'currentPriceLabelText',
        },
        { kind: 'restore' },
      );
      if (
        crosshair.visible &&
        Math.abs(crosshair.x - x) <= MARK_RADIUS + 4 &&
        Math.abs(crosshair.y - y) <= MARK_RADIUS + 4
      ) {
        hoveredMark = layout;
      }
    });
  });
  if (hoveredMark?.text) {
    appendTradeMarkTooltip({
      commands,
      mark: hoveredMark,
      measureTextWidth,
      priceAxisX,
      priceChartHeight,
    });
  }
  return layouts;
}
