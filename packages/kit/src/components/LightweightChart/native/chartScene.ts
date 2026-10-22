import {
  formatChartTickMarkInTimeZone,
  formatChartTickMarkWithoutUnit,
} from '../utils/chartOptions';
import {
  formatChartPrice,
  formatChartPriceFullTicks,
} from '../utils/formatChartPrice';

import type { ITradingViewNativeSkiaCommand } from '../../TradingView/TradingViewNative/native/chartSkiaRenderer';
import type {
  ITradingViewNativeChartSceneFont,
  ITradingViewNativeChartScenePaintStyle,
} from '../../TradingView/TradingViewNative/utils/chartScene';
import type {
  ILightweightChartConfig,
  ILightweightChartProps,
  ILightweightChartTime,
} from '../types';

type IPoint = { x: number; y: number };
type IMeasureText = (
  text: string,
  font: ITradingViewNativeChartSceneFont,
) => number;
export type INativeChartScene = {
  commands: ITradingViewNativeSkiaCommand[];
  customPaintStyles: Record<string, ITradingViewNativeChartScenePaintStyle>;
  plot: { x: number; y: number; width: number; height: number };
  points: (IPoint & {
    time: number;
    price: number;
  })[];
  hoverPoints: (IPoint & {
    time: number;
    price?: number;
    secondaryPrice?: number;
    priceLabel: string;
  })[];
  axisWidth: number;
  secondarySegments: IPoint[][];
  lastPoint?: IPoint;
  fontSize: number;
  crosshairColor: string;
  crosshairDash?: [number, number];
  showCrosshairPrice: boolean;
  axisOnLeft: boolean;
};

function lineDash(style = 3): [number, number] | undefined {
  switch (style) {
    case 1:
      return [1, 2];
    case 2:
      return [4, 4];
    case 3:
      return [6, 6];
    case 4:
      return [1, 4];
    default:
      return undefined;
  }
}

export function formatNativeChartPrice(
  price: number,
  config: ILightweightChartConfig,
) {
  if (config.priceFormatter) return config.priceFormatter(price);
  if (
    config.priceScaleFormat ||
    config.compactPriceMaxCharacters ||
    config.priceFormatterType === 'usd'
  ) {
    return formatChartPrice(
      price,
      config.compactPriceMaxCharacters ?? 8,
      config.priceScaleFormat === 'stock',
      config.priceScaleFormat === 'full' ? 'cents' : false,
    );
  }
  const precision = config.priceFormatterPrecision ?? 2;
  return `${Number(price.toFixed(precision))}${config.priceFormatterType === 'percent' ? '%' : ''}`;
}

function niceStep(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  return (
    ([1, 2, 2.5, 5, 10].find((step) => step >= normalized) ?? 10) * magnitude
  );
}

function timeLabel(
  time: number,
  type: number,
  config: ILightweightChartConfig,
) {
  const label =
    formatChartTickMarkInTimeZone({
      time: time as ILightweightChartTime,
      tickMarkType: type,
      timeZone:
        config.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: config.locale,
    }) ?? '';
  if (config.useTimeScaleTickMarkWithoutUnit && !config.timeZone) {
    return (
      formatChartTickMarkWithoutUnit(
        time as ILightweightChartTime,
        type,
        config.locale ?? 'en',
      ) ?? ''
    );
  }
  return label;
}

export function buildNativeChartScene({
  config,
  width,
  height,
  measureText,
}: {
  config: ILightweightChartConfig;
  width: number;
  height: number;
  measureText: IMeasureText;
}): INativeChartScene {
  const commands: ITradingViewNativeSkiaCommand[] = [];
  const customPaintStyles: INativeChartScene['customPaintStyles'] = {};
  const fontSize = config.fontSize ?? 12;
  const showTimeScale = config.showTimeScale !== false;
  const plotHeight = Math.max(0, height - (showTimeScale ? fontSize + 16 : 0));
  const data = config.data.filter(
    (point) => Number.isFinite(point.value) && Number.isFinite(point.time),
  );
  const secondary = config.secondaryLineData ?? [];
  const values = [
    ...data.map((point) => point.value),
    ...secondary.flatMap((point) =>
      'value' in point && Number.isFinite(point.value) ? [point.value] : [],
    ),
  ];
  const base =
    config.seriesType === 'baseline'
      ? (config.baselineOptions?.baseValue?.price ?? 0)
      : (config.histogramOptions?.base ?? 0);
  if (config.seriesType === 'baseline' || config.seriesType === 'histogram')
    values.push(base);
  if (config.referenceLine?.includeInAutoscale)
    values.push(config.referenceLine.price);
  let min = values.length ? Math.min(...values) : 0;
  let max = values.length ? Math.max(...values) : 1;
  if (min === max) {
    const padding = Math.abs(min) * 0.01 || 0.01;
    min -= padding;
    max += padding;
  }
  const margins = config.priceScaleMargins ?? { top: 0.2, bottom: 0.1 };
  const drawableHeight = Math.max(
    1,
    plotHeight * (1 - margins.top - margins.bottom),
  );
  const range = max - min;
  const valueAtY = (y: number) =>
    max - ((y - plotHeight * margins.top) / drawableHeight) * range;
  const yAtValue = (price: number) =>
    plotHeight * margins.top + ((max - price) / range) * drawableHeight;
  const step = Math.max(
    config.priceFormatterTickStep ?? 0,
    niceStep(range / Math.max(2, drawableHeight / (fontSize * 3))),
  );
  const ticks: number[] = [];
  for (
    let value = Math.ceil(valueAtY(plotHeight - fontSize) / step) * step;
    value <= valueAtY(fontSize);
    value += step
  ) {
    ticks.push(Number(value.toPrecision(12)));
    if (ticks.length > 100) break;
  }
  const tickLabels =
    config.priceTickFormatter?.(ticks) ??
    (config.priceScaleFormat === 'full'
      ? formatChartPriceFullTicks(ticks)
      : ticks.map((value) => formatNativeChartPrice(value, config)));
  const axisWidth = config.showPriceScale
    ? Math.max(
        config.priceScaleMinimumWidth ?? 0,
        ...[
          ...tickLabels,
          ...data.slice(-1).map((p) => formatNativeChartPrice(p.value, config)),
          ...(config.referenceLine
            ? [formatNativeChartPrice(config.referenceLine.price, config)]
            : []),
        ].map((text) => measureText(text, 'priceAxis') + 12),
      )
    : 0;
  const axisOnLeft = config.priceScalePosition === 'left';
  const plot = {
    x: axisOnLeft ? axisWidth : 0,
    y: 0,
    width: Math.max(0, width - axisWidth),
    height: plotHeight,
  };
  const lastX = Math.max(
    plot.x,
    plot.x + plot.width - (config.timeScaleRightOffsetPixels ?? 0) - 2,
  );
  const firstX = plot.x + 2;
  // lightweight-charts uses logical spacing across the union of series times.
  const timeline = [
    ...new Set([
      ...data.map((p) => Number(p.time)),
      ...secondary.map((p) => Number(p.time)),
    ]),
  ].toSorted((a, b) => a - b);
  const indexByTime = new Map(timeline.map((time, index) => [time, index]));
  const xAtIndex = (index: number) =>
    timeline.length <= 1
      ? (firstX + lastX) / 2
      : firstX + (index / (timeline.length - 1)) * (lastX - firstX);
  const primaryByTime = new Map(data.map((p) => [Number(p.time), p.value]));
  const secondaryByTime = new Map(
    secondary.flatMap((point) =>
      'value' in point ? [[Number(point.time), point.value] as const] : [],
    ),
  );
  const hoverPoints = timeline.flatMap((time, index) => {
    const price = primaryByTime.get(time);
    const secondaryPrice = secondaryByTime.get(time);
    if (price === undefined && secondaryPrice === undefined) return [];
    const value = price ?? secondaryPrice ?? 0;
    return [
      {
        x: xAtIndex(index),
        y: yAtValue(value),
        time,
        price,
        secondaryPrice,
        priceLabel: formatNativeChartPrice(value, config),
      },
    ];
  });
  const points = data.map((point) => ({
    x: xAtIndex(indexByTime.get(Number(point.time)) ?? 0),
    y: yAtValue(point.value),
    time: Number(point.time),
    price: point.value,
  }));
  const style = (
    id: string,
    color: string,
    strokeWidth?: number,
    dash?: [number, number],
    opacity = 1,
  ) => {
    customPaintStyles[id] = {
      color,
      opacity,
      ...(strokeWidth
        ? {
            drawStyle: 'stroke',
            strokeWidth,
            strokeCap: 'round',
            strokeJoin: 'round',
            dash,
          }
        : {}),
    };
    return id;
  };
  const line = (
    id: string,
    color: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    strokeWidth = 1,
    dash?: [number, number],
  ) =>
    commands.push({
      kind: 'line',
      paint: 'lineStroke',
      customPaintId: style(id, color, strokeWidth, dash),
      x1,
      x2,
      y1,
      y2,
    });
  style('axis', config.theme.textSubduedColor);
  if (width <= 0 || height <= 0 || !points.length)
    return {
      commands,
      customPaintStyles,
      plot,
      points,
      hoverPoints,
      axisWidth,
      secondarySegments: [],
      fontSize,
      axisOnLeft,
      crosshairColor: '',
      showCrosshairPrice: false,
    };
  if (config.showHorzGridLines)
    ticks.forEach((price) =>
      line(
        'grid',
        config.horzLineColor ?? '#E5E5EA',
        plot.x,
        yAtValue(price),
        plot.x + plot.width,
        yAtValue(price),
        1,
        lineDash(config.horzLineStyle ?? 2),
      ),
    );
  commands.push({ kind: 'clip', rect: plot });
  const linePoints = (source: IPoint[]) =>
    config.lineType === 'steps'
      ? source.flatMap((point, i) =>
          i ? [{ x: point.x, y: source[i - 1].y }, point] : [point],
        )
      : source;
  const areaBottom =
    config.seriesType === 'baseline' ? yAtValue(base) : plotHeight;
  const polygon = [
    { x: points[0].x, y: areaBottom },
    ...linePoints(points),
    { x: points[points.length - 1].x, y: areaBottom },
  ];
  if (config.seriesType === 'dotted-area') {
    commands.push({ kind: 'clipPolygon', points: polygon });
    style(
      'pattern',
      config.patternColor ?? config.theme.lineColor,
      undefined,
      undefined,
      0.28,
    );
    const top = Math.max(0, Math.min(...points.map((p) => p.y)));
    for (
      let x = Math.floor(points[0].x / 10) * 10 + 5;
      x <= lastX + 10;
      x += 10
    ) {
      for (let y = Math.floor(top / 10) * 10 + 5; y <= plotHeight + 10; y += 10)
        commands.push({
          kind: 'circle',
          paint: 'line',
          customPaintId: 'pattern',
          cx: x,
          cy: y,
          radius: 0.9,
        });
    }
    commands.push({ kind: 'restore' });
  } else if (config.seriesType !== 'histogram') {
    commands.push({ kind: 'clipPolygon', points: polygon });
    if (config.seriesType === 'baseline') {
      const baseline = Math.max(0, Math.min(plotHeight, yAtValue(base)));
      commands.push({
        kind: 'linearGradientRect',
        rect: { ...plot, height: baseline },
        colors: [
          config.baselineOptions?.topFillColor1 ?? config.theme.topColor,
          config.baselineOptions?.topFillColor2 ?? config.theme.bottomColor,
        ],
      });
      commands.push({
        kind: 'linearGradientRect',
        rect: { ...plot, y: baseline, height: plotHeight - baseline },
        colors: [
          config.baselineOptions?.bottomFillColor1 ?? config.theme.bottomColor,
          config.baselineOptions?.bottomFillColor2 ?? config.theme.topColor,
        ],
      });
    } else
      commands.push({
        kind: 'linearGradientRect',
        rect: plot,
        colors: [config.theme.topColor, config.theme.bottomColor],
      });
    commands.push({ kind: 'restore' });
  }
  if (config.seriesType === 'histogram') {
    const options = config.histogramOptions;
    const barWidth = Math.max(
      1,
      Math.min(
        options?.maxBarWidth ?? 4,
        ((lastX - firstX) / Math.max(1, points.length)) *
          (options?.barWidthRatio ?? 0.5),
      ),
    );
    points.forEach((point) => {
      if (point.price === base) return;
      const color =
        point.price >= base
          ? (options?.positiveColor ?? config.theme.lineColor)
          : (options?.negativeColor ?? config.theme.lineColor);
      commands.push({
        kind: 'rect',
        paint: 'line',
        customPaintId: style(
          point.price >= base ? 'positive' : 'negative',
          color,
        ),
        x: point.x - barWidth / 2,
        y: Math.min(point.y, yAtValue(base)),
        width: barWidth,
        height: Math.abs(point.y - yAtValue(base)),
      });
    });
  } else if (config.seriesType === 'baseline') {
    const baselineY = Math.max(0, Math.min(plotHeight, yAtValue(base)));
    for (const [id, color, y, h] of [
      [
        'positive',
        config.baselineOptions?.topLineColor ?? config.theme.lineColor,
        0,
        baselineY,
      ],
      [
        'negative',
        config.baselineOptions?.bottomLineColor ?? config.theme.lineColor,
        baselineY,
        plotHeight - baselineY,
      ],
    ] as const) {
      commands.push({ kind: 'clip', rect: { ...plot, y, height: h } });
      commands.push({
        kind: 'polyline',
        paint: 'lineStroke',
        customPaintId: style(id, color, config.lineWidth),
        points: linePoints(points),
      });
      commands.push({ kind: 'restore' });
    }
  } else
    commands.push({
      kind: 'polyline',
      paint: 'lineStroke',
      customPaintId: style('primary', config.theme.lineColor, config.lineWidth),
      points: linePoints(points),
    });
  const secondarySegments: IPoint[][] = [];
  let segment: IPoint[] = [];
  secondary.forEach((point) => {
    const index = indexByTime.get(Number(point.time));
    if (!('value' in point) || index === undefined) {
      if (segment.length) secondarySegments.push(segment);
      segment = [];
      return;
    }
    segment.push({ x: xAtIndex(index), y: yAtValue(point.value) });
  });
  if (segment.length) secondarySegments.push(segment);
  style(
    'secondary',
    config.secondaryLineColor ?? config.theme.lineColor,
    config.secondaryLineWidth ?? 2,
  );
  secondarySegments.forEach((part) => {
    if (part.length > 1)
      commands.push({
        kind: 'polyline',
        paint: 'lineStroke',
        customPaintId: 'secondary',
        points: part,
      });
    else
      commands.push({
        kind: 'circle',
        paint: 'line',
        customPaintId: style(
          'secondaryPoint',
          config.secondaryLineColor ?? config.theme.lineColor,
        ),
        cx: part[0].x,
        cy: part[0].y,
        radius: (config.secondaryLineWidth ?? 2) / 2,
      });
  });
  const lastPoint = points[points.length - 1];
  if (
    config.showLastPointMarker !== false &&
    config.seriesType === 'dotted-area'
  )
    commands.push({
      kind: 'circle',
      paint: 'line',
      customPaintId: style('lastPoint', config.theme.lineColor),
      cx: lastPoint.x,
      cy: lastPoint.y,
      radius: 5.5,
    });
  if (config.referenceLine)
    line(
      'referenceLine',
      config.referenceLine.color,
      plot.x,
      yAtValue(config.referenceLine.price),
      plot.x + plot.width,
      yAtValue(config.referenceLine.price),
      config.referenceLine.lineWidth ?? 1,
      lineDash(
        {
          solid: 0,
          dotted: 1,
          dashed: 2,
          'large-dashed': 3,
          'sparse-dotted': 4,
        }[config.referenceLine.lineStyle ?? 'solid'],
      ),
    );
  if (config.showLastValue && config.showLastValuePriceLine !== false)
    line(
      'lastValueLine',
      config.lastValueLabelColor ?? config.theme.lineColor,
      plot.x,
      lastPoint.y,
      plot.x + plot.width,
      lastPoint.y,
      1,
      lineDash(2),
    );
  commands.push({ kind: 'restore' });
  const axisX = axisOnLeft ? 6 : plot.x + plot.width + 6;
  if (config.showPriceScale) {
    const labelHeight = fontSize + 6;
    const clampLabelY = (value: number) =>
      Math.min(
        plotHeight - labelHeight / 2,
        Math.max(labelHeight / 2, yAtValue(value)),
      );
    let lastLabelY = clampLabelY(lastPoint.price);
    let referenceLabelY = config.referenceLine
      ? clampLabelY(config.referenceLine.price)
      : undefined;
    if (
      config.showLastValue &&
      config.referenceLine?.axisLabelVisible &&
      referenceLabelY !== undefined &&
      Math.abs(lastLabelY - referenceLabelY) < labelHeight
    ) {
      const center = Math.max(
        labelHeight,
        Math.min(plotHeight - labelHeight, (lastLabelY + referenceLabelY) / 2),
      );
      const lastIsAbove = lastLabelY < referenceLabelY;
      lastLabelY = center + ((lastIsAbove ? -1 : 1) * labelHeight) / 2;
      referenceLabelY = center + ((lastIsAbove ? 1 : -1) * labelHeight) / 2;
    }
    ticks.forEach((price, i) => {
      const y = yAtValue(price);
      if (
        config.priceScaleEntireTextOnly &&
        (y < fontSize || y > plotHeight - fontSize / 2)
      )
        return;
      if (
        (config.showLastValue && Math.abs(y - lastLabelY) < labelHeight) ||
        (config.referenceLine?.axisLabelVisible &&
          referenceLabelY !== undefined &&
          Math.abs(y - referenceLabelY) < labelHeight)
      )
        return;
      commands.push({
        kind: 'text',
        paint: 'axisText',
        customPaintId: 'axis',
        font: 'priceAxis',
        text: tickLabels[i],
        x: axisX,
        y: y + fontSize * 0.35,
      });
    });
    const axisLabel = (
      id: string,
      price: number,
      color: string,
      textColor: string,
      y: number,
    ) => {
      commands.push({
        kind: 'rect',
        paint: 'line',
        customPaintId: style(id, color),
        x: axisOnLeft ? 0 : plot.x + plot.width,
        y: y - labelHeight / 2,
        width: axisWidth,
        height: labelHeight,
      });
      commands.push({
        kind: 'text',
        paint: 'axisText',
        customPaintId: style(`${id}.text`, textColor),
        font: 'priceAxis',
        text: formatNativeChartPrice(price, config),
        x: axisX,
        y: y + fontSize * 0.35,
      });
    };
    const ref = config.referenceLine;
    if (ref?.axisLabelVisible) {
      const color = ref.axisLabelColor ?? ref.color;
      axisLabel(
        'referenceLabel',
        ref.price,
        color,
        ref.axisLabelTextColor ?? '#fff',
        referenceLabelY ?? clampLabelY(ref.price),
      );
      if (ref.title) {
        const textWidth = measureText(ref.title, 'referenceLineLabel');
        const y = Math.min(
          plotHeight - labelHeight,
          Math.max(0, yAtValue(ref.price) - labelHeight),
        );
        const x = axisOnLeft ? plot.x : plot.x + plot.width - textWidth - 8;
        commands.push({
          kind: 'rect',
          paint: 'line',
          customPaintId: 'referenceLabel',
          x,
          y,
          width: textWidth + 8,
          height: labelHeight,
        });
        commands.push({
          kind: 'text',
          paint: 'axisText',
          customPaintId: 'referenceLabel.text',
          font: 'referenceLineLabel',
          text: ref.title,
          x: x + 4,
          y: y + fontSize + 2,
        });
      }
    }
    if (config.showLastValue)
      axisLabel(
        'lastLabel',
        lastPoint.price,
        config.lastValueLabelColor ?? config.theme.lineColor,
        '#fff',
        lastLabelY,
      );
  }
  if (showTimeScale) {
    const candidates = points.map((point, index) => {
      const previous = points[index - 1];
      const year = timeLabel(point.time, 0, config);
      const month = timeLabel(point.time, 1, config);
      const day = timeLabel(point.time, 2, config);
      let type = 3;
      if (previous && year !== timeLabel(previous.time, 0, config)) type = 0;
      else if (previous && month !== timeLabel(previous.time, 1, config))
        type = 1;
      else if (!previous || day !== timeLabel(previous.time, 2, config))
        type = 2;
      return {
        ...point,
        text: timeLabel(point.time, type, config),
        priority: 4 - type,
      };
    });
    const positioned = candidates.map((point) => {
      const textWidth = measureText(point.text, 'axis');
      return {
        ...point,
        textWidth,
        left: Math.max(
          plot.x,
          Math.min(plot.x + plot.width - textWidth, point.x - textWidth / 2),
        ),
      };
    });
    const chosen: typeof positioned = [];
    for (const candidate of positioned.toSorted(
      (a, b) => b.priority - a.priority || a.x - b.x,
    )) {
      if (
        chosen.every(
          (p) =>
            candidate.left >= p.left + p.textWidth + 20 ||
            p.left >= candidate.left + candidate.textWidth + 20,
        )
      )
        chosen.push(candidate);
    }
    chosen.forEach((point) => {
      commands.push({
        kind: 'text',
        paint: 'axisText',
        customPaintId: 'axis',
        font: 'axis',
        text: point.text,
        x: point.left,
        y: plotHeight + fontSize + 7,
      });
    });
  }
  return {
    commands,
    customPaintStyles,
    plot,
    points,
    hoverPoints,
    axisWidth,
    secondarySegments,
    lastPoint,
    fontSize,
    axisOnLeft,
    crosshairColor: config.crosshairVertLineColor ?? 'rgba(150, 150, 150, 0.4)',
    crosshairDash: lineDash(config.crosshairVertLineStyle),
    showCrosshairPrice:
      !config.hideCrosshairPriceLabel && !!config.showPriceScale,
  };
}

export function getNativeChartHover(
  scene: INativeChartScene,
  x: number,
  y: number,
): Parameters<NonNullable<ILightweightChartProps['onHover']>>[0] {
  'worklet';
  if (
    !scene.points.length ||
    x < scene.plot.x ||
    x > scene.plot.x + scene.plot.width ||
    y < 0 ||
    y > scene.plot.height
  )
    return {};
  let lower = 0;
  let upper = scene.hoverPoints.length - 1;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (scene.hoverPoints[middle].x < x) lower = middle + 1;
    else upper = middle;
  }
  const next = scene.hoverPoints[lower];
  const previous = scene.hoverPoints[Math.max(0, lower - 1)];
  const point =
    Math.abs(x - previous.x) <= Math.abs(next.x - x) ? previous : next;
  return {
    time: point.time,
    price: point.price,
    secondaryPrice: point.secondaryPrice,
    x: x - scene.plot.x,
    y,
  };
}

export function buildNativeChartCrosshair(
  scene: INativeChartScene,
  x: number,
  y: number,
  scrub?: ILightweightChartConfig['nativeScrubOptions'],
) {
  'worklet';
  const hover = getNativeChartHover(scene, x, y);
  const point = scene.hoverPoints.find((p) => p.time === hover.time);
  const commands: INativeChartScene['commands'] = [];
  const customPaintStyles: INativeChartScene['customPaintStyles'] = {
    ...scene.customPaintStyles,
    crosshair: {
      color: scene.crosshairColor,
      opacity: 1,
      drawStyle: 'stroke',
      strokeWidth: 1,
      dash: scene.crosshairDash,
    },
    hoverDot: {
      color:
        scene.customPaintStyles.secondary?.color ??
        scene.customPaintStyles.primary?.color ??
        '#33C641',
      opacity: 1,
    },
    hoverBackground: { color: '#4C525E', opacity: 1 },
    hoverText: { color: '#FFFFFF', opacity: 1 },
  };
  if (!point) return { commands, customPaintStyles };
  commands.push({ kind: 'clip', rect: scene.plot });
  commands.push({
    kind: 'line',
    paint: 'crosshairLine',
    customPaintId: 'crosshair',
    x1: point.x,
    x2: point.x,
    y1: 0,
    y2: scene.plot.height,
  });
  if (scrub) {
    // Stock charts keep the dimmed full line and cut only the solid overlay.
    for (const segment of scene.secondarySegments) {
      const points = segment.filter((p) => p.x <= point.x);
      if (points.length > 1)
        commands.push({
          kind: 'polyline',
          paint: 'lineStroke',
          customPaintId: 'secondary',
          points,
        });
    }
  }
  commands.push({
    kind: 'circle',
    paint: 'line',
    customPaintId: 'hoverText',
    cx: point.x,
    cy: point.y,
    radius: 5,
  });
  commands.push({
    kind: 'circle',
    paint: 'line',
    customPaintId: 'hoverDot',
    cx: point.x,
    cy: point.y,
    radius: 3.5,
  });
  commands.push({ kind: 'restore' });
  const h = scene.fontSize + 6;
  if (scene.showCrosshairPrice) {
    const axisX = scene.axisOnLeft ? 0 : scene.plot.x + scene.plot.width;
    const axisWidth = scene.axisWidth;
    const top = Math.max(0, Math.min(scene.plot.height - h, point.y - h / 2));
    commands.push({
      kind: 'rect',
      paint: 'line',
      customPaintId: 'hoverBackground',
      x: axisX,
      y: top,
      width: axisWidth,
      height: h,
    });
    commands.push({
      kind: 'text',
      paint: 'axisText',
      customPaintId: 'hoverText',
      font: 'priceAxis',
      text: point.priceLabel,
      x: axisX + 6,
      y: top + scene.fontSize + 2,
    });
  }
  const label = scrub?.labels[point.time];
  if (scrub && label) {
    const width = 120;
    let height = 30;
    if (label.price !== undefined) height = scrub.largePrice ? 52 : 48;
    const left = Math.max(
      8,
      Math.min(
        scene.plot.x + scene.plot.width - width - 8,
        x < (scene.plot.x + scene.plot.width) / 2 ? x + 10 : x - width - 10,
      ),
    );
    const top = Math.max(8, y - 56);
    customPaintStyles.tooltip = { color: scrub.backgroundColor, opacity: 1 };
    customPaintStyles.tooltipBorder = {
      color: scrub.borderColor,
      opacity: 1,
      drawStyle: 'stroke',
      strokeWidth: 1,
    };
    customPaintStyles.tooltipTime = { color: scrub.timeColor, opacity: 1 };
    customPaintStyles.tooltipPrice = { color: scrub.textColor, opacity: 1 };
    commands.push({
      kind: 'roundRect',
      paint: 'line',
      customPaintId: 'tooltip',
      radius: 8,
      x: left,
      y: top,
      width,
      height,
    });
    commands.push({
      kind: 'roundRect',
      paint: 'line',
      customPaintId: 'tooltipBorder',
      radius: 8,
      x: left,
      y: top,
      width,
      height,
    });
    commands.push({
      kind: 'text',
      paint: 'axisText',
      customPaintId: 'tooltipTime',
      font: 'tradingLineLabel',
      text: label.time,
      x: left + 8,
      y: top + 19,
    });
    if (label.price !== undefined)
      commands.push({
        kind: 'text',
        paint: 'axisText',
        customPaintId: 'tooltipPrice',
        font: 'legend',
        text: label.price,
        x: left + 8,
        y: top + height - 8,
      });
  }
  return { commands, customPaintStyles };
}
