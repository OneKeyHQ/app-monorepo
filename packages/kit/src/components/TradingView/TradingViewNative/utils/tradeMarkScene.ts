import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
  TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE,
} from '../chartConstants';

import { getTradingViewNativeCandleTimestampAtOffset } from './candleTime';
import { getTradingViewNativePriceY } from './chartLayout';

import type { ITradingViewNativeChartRuntimeCrosshair } from './chartRuntime';
import type {
  ITradingViewNativeChartSceneCommand,
  ITradingViewNativeChartSceneFont,
  ITradingViewNativeChartScenePaintStyle,
  ITradingViewNativeSceneComponents,
} from './chartScene';
import type { ITradingViewNativePrimarySeriesPriceSource } from './chartType';
import type {
  ITradingViewNativeCandleTimeMode,
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
  candleTimeMode,
}: {
  points: readonly IMarketTokenKLineDataPoint[];
  timestamp: number;
  candleIntervalSeconds: number;
  candleTimeMode?: ITradingViewNativeCandleTimeMode;
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
  const end = getTradingViewNativeCandleTimestampAtOffset({
    timestamp: point.t,
    candleIntervalSeconds,
    candleTimeMode,
    offset: 1,
  });
  // Do not attach trades in a missing candle to the preceding candle.
  return time < Math.min(end, points[index + 1]?.t ?? end) ? index : null;
}

export interface ITradingViewNativeTradeMarkLayout {
  id: string;
  label: string;
  text: string;
  fillCount?: number;
  x: number;
  y: number;
}

const COMPACT_MARK_SIZE = 11;

// Try the closest free spot first. Index only visible tags so crosshair redraws
// need not compare every fill against every other fill.
function placeTradeTag(
  occupied: Map<number, { x: number; y: number }[]>,
  candleX: number,
  highY: number,
  lowY: number,
  buy: boolean,
  plotRight: number,
  plotTop: number,
  plotBottom: number,
) {
  'worklet';

  const spacing = COMPACT_MARK_SIZE + 2;
  const minX =
    TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING + COMPACT_MARK_SIZE / 2;
  const maxX = plotRight - COMPACT_MARK_SIZE / 2;
  if (
    minX > maxX ||
    candleX < minX - COMPACT_MARK_SIZE / 2 ||
    candleX > plotRight
  )
    return undefined;
  const x = Math.max(minX, Math.min(maxX, candleX));
  const bucket = Math.floor(x / spacing);
  const nearby = [bucket - 1, bucket, bucket + 1];
  for (let row = 0; row < MAX_MARKS_PER_BAR; row += 1) {
    for (const below of [buy, !buy]) {
      const direction = below ? 1 : -1;
      const anchorY = below ? lowY : highY;
      const y =
        anchorY + direction * (COMPACT_MARK_SIZE / 2 + 2 + row * spacing);
      if (
        anchorY >= plotTop &&
        anchorY <= plotBottom &&
        y - COMPACT_MARK_SIZE / 2 >= plotTop &&
        y + COMPACT_MARK_SIZE / 2 <= plotBottom &&
        !nearby.some((i) =>
          occupied
            .get(i)
            ?.some(
              (tag) =>
                Math.abs(tag.x - x) < spacing && Math.abs(tag.y - y) < spacing,
            ),
        )
      ) {
        const neighbors = occupied.get(bucket);
        if (neighbors) neighbors.push({ x, y });
        else occupied.set(bucket, [{ x, y }]);
        return { x, y };
      }
    }
  }
  return undefined;
}

function appendTradeMarkTooltip({
  commands,
  mark,
  measureTextWidth,
  priceAxisX,
  priceChartTop,
  priceChartHeight,
}: {
  commands: ITradingViewNativeChartSceneCommand[];
  mark: ITradingViewNativeTradeMarkLayout;
  measureTextWidth: (
    text: string,
    font: ITradingViewNativeChartSceneFont,
  ) => number;
  priceAxisX: number;
  priceChartTop?: number;
  priceChartHeight: number;
}) {
  'worklet';

  const padding = 8;
  const chartBottom =
    (priceChartTop ?? TRADING_VIEW_NATIVE_CHART_TOP_PADDING) + priceChartHeight;
  const lineHeight = TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE + 5;
  const maxWidth = Math.min(300, priceAxisX - padding * 2);
  const maxLines = Math.min(
    6,
    Math.floor((chartBottom - padding * 2) / lineHeight),
  );
  if (maxWidth <= padding * 2 || maxLines < 1) {
    return;
  }
  const lines: string[] = [];
  let line = '';
  const tooltipText = mark.fillCount
    ? `${mark.label} × ${mark.fillCount}\n${mark.text}${mark.fillCount > 2 ? '\n…' : ''}`
    : mark.text;
  for (const character of tooltipText) {
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
    Math.min(mark.y + MARK_RADIUS + padding, chartBottom - height),
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
  candleTimeMode,
  commands,
  components: { nodes: components, marketDetailLayout = false, priceChartTop },
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
  priceSource,
  tooltipCommands,
}: {
  candleIntervalSeconds: number;
  candleTimeMode?: ITradingViewNativeCandleTimeMode;
  commands: ITradingViewNativeChartSceneCommand[];
  components: ITradingViewNativeSceneComponents;
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
  priceSource: ITradingViewNativePrimarySeriesPriceSource;
  tooltipCommands?: ITradingViewNativeChartSceneCommand[];
}): ITradingViewNativeTradeMarkLayout[] {
  'worklet';

  const layouts: ITradingViewNativeTradeMarkLayout[] = [];
  const chartBottom =
    (priceChartTop ?? TRADING_VIEW_NATIVE_CHART_TOP_PADDING) + priceChartHeight;
  const plotTop = priceChartTop ?? TRADING_VIEW_NATIVE_CHART_TOP_PADDING;
  const occupied = marketDetailLayout
    ? new Map<number, { x: number; y: number }[]>()
    : undefined;
  const priceLayout = {
    maxPrice,
    minPrice,
    priceChartTop,
    priceChartHeight,
    priceScaleMode,
  };
  const candleGroups = marketDetailLayout
    ? new Map<number, ITradingViewNativeTradeMarkLayout>()
    : undefined;
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
        candleTimeMode,
        points,
        timestamp: mark.time,
      });
      if (index === null) {
        return;
      }
      const candleX = getPointX(index);
      const groupKey = index * 2 + (mark.label === 'S' ? 1 : 0);
      const group = candleGroups?.get(groupKey);
      if (group) {
        group.fillCount = (group.fillCount ?? 1) + 1;
        // The tooltip fits two fill details; keep counting the rest.
        if (group.fillCount === 2) group.text += `\n${mark.text}`;
        return;
      }
      const order = barCounts[index] ?? 0;
      if (!marketDetailLayout) barCounts[index] = order + 1;
      if (
        order >= MAX_MARKS_PER_BAR ||
        candleX + MARK_RADIUS < TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING ||
        candleX - MARK_RADIUS > priceAxisX
      ) {
        return;
      }
      const point = points[index];
      const highY = getTradingViewNativePriceY(
        priceSource === 'close' ? point.c : point.h,
        priceLayout,
      );
      const tag = occupied
        ? placeTradeTag(
            occupied,
            candleX,
            highY,
            getTradingViewNativePriceY(
              priceSource === 'close' ? point.c : point.l,
              priceLayout,
            ),
            mark.label === 'B',
            priceAxisX,
            plotTop,
            chartBottom,
          )
        : undefined;
      if (occupied && !tag) return;
      const x = tag?.x ?? candleX;
      const y = tag?.y ?? highY - MARK_SIZE * 1.4 * (order + 0.85);
      if (
        !Number.isFinite(y) ||
        y + MARK_RADIUS < 0 ||
        y - MARK_RADIUS > chartBottom
      )
        return;
      const layout = { id: mark.id, label: mark.label, text: mark.text, x, y };
      candleGroups?.set(groupKey, layout);
      layouts.push(layout);
      const isBuy = mark.label === 'B';
      const paintId = isBuy ? BUY_PAINT_ID : SELL_PAINT_ID;
      if (!marketDetailLayout) {
        customPaintStyles[paintId] = {
          color: isBuy ? '#26a69a' : '#ef5350',
          opacity: 1,
        };
      }
      customPaintStyles[TEXT_PAINT_ID] = { color: '#FFFFFF', opacity: 1 };
      commands.push({
        kind: 'clip',
        rect: {
          x: TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
          y: tag ? plotTop : 0,
          width: priceAxisX - TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
          height: tag ? chartBottom - plotTop : chartBottom,
        },
      });
      commands.push({
        kind: 'circle',
        cx: x,
        cy: y,
        radius: tag ? COMPACT_MARK_SIZE / 2 : MARK_RADIUS,
        customPaintId: marketDetailLayout ? undefined : paintId,
        paint: isBuy ? 'up' : 'down',
      });
      commands.push(
        {
          kind: 'tradeMarkLabel',
          ...(tag ? { scale: 0.75 } : {}),
          label: mark.label,
          cx: x,
          cy: y,
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
        if (
          !tag ||
          !hoveredMark ||
          Math.hypot(crosshair.x - x, crosshair.y - y) <
            Math.hypot(crosshair.x - hoveredMark.x, crosshair.y - hoveredMark.y)
        ) {
          hoveredMark = layout;
        }
      }
    });
  });
  if (hoveredMark?.text) {
    appendTradeMarkTooltip({
      commands: tooltipCommands ?? commands,
      mark: hoveredMark,
      measureTextWidth,
      priceAxisX,
      priceChartTop,
      priceChartHeight,
    });
  }
  return layouts;
}
