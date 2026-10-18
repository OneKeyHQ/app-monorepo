import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

// cspell:ignore intrabar
import { getGhostFeedCandles } from './ghostFeed';
import {
  formatDrawingNumber,
  getDrawingMeasurement,
  getDrawingPricePrecision,
} from './measurement';
import {
  drawingPointToScreen,
  indexAtTime,
  screenToDrawingPoint,
} from './model';
import { drawingArrowHead, extendDrawingLine } from './pathUtils';

import type { IDrawingGeometry } from './geometry';
import type { IDrawing, IDrawingProjection, IScreenPoint } from './model';

export function prepareDrawing(
  drawing: IDrawing,
  projection: IDrawingProjection,
): IDrawing {
  'worklet';
  const first = drawing.points[0];
  if (!first) return drawing;
  const a = drawingPointToScreen(first, projection);
  if (
    (drawing.tool === 'longPosition' || drawing.tool === 'shortPosition') &&
    drawing.points.length === 1
  ) {
    const direction = drawing.tool === 'longPosition' ? -1 : 1;
    const height = Math.max(20, projection.layout.mainChartBottom * 0.12);
    return {
      ...drawing,
      points: [
        first,
        screenToDrawingPoint(
          { x: a.x + 120, y: a.y + direction * height },
          projection,
        ),
        screenToDrawingPoint(
          { x: a.x, y: a.y - direction * height },
          projection,
        ),
      ],
    };
  }
  if (
    (drawing.tool === 'anchoredText' || drawing.tool === 'table') &&
    !drawing.anchor
  )
    return {
      ...drawing,
      anchor: {
        x: a.x / projection.layout.priceAxisX,
        y: a.y / projection.layout.mainChartBottom,
      },
    };
  if (drawing.tool === 'ghostFeed' && !drawing.sourceInterval) {
    const recent = projection.points.slice(-30);
    const average =
      recent.reduce((sum, point) => sum + Math.max(0, point.h - point.l), 0) /
      Math.max(1, recent.length);
    const ticks = Math.max(
      1,
      Math.round(average * 10 ** getDrawingPricePrecision(projection)),
    );
    return {
      ...drawing,
      sourceInterval: projection.interval,
      candleRange: drawing.candleRange ?? ticks,
      candleVariance: drawing.candleVariance ?? ticks / 2,
    };
  }
  if (drawing.tool === 'barsPattern' && !drawing.source) {
    const last = drawing.points[1] ?? first;
    const min = Math.min(first.time, last.time);
    const max = Math.max(first.time, last.time);
    const source = projection.points
      .filter((point) => point.t >= min && point.t <= max)
      .slice(0, 2000);
    if (source.length)
      return {
        ...drawing,
        source,
        points: [
          { time: source[0].t, price: source[0].c },
          {
            time: source[source.length - 1].t,
            price: source[source.length - 1].c,
          },
        ],
      };
  }
  return drawing;
}

export function getPositionStatistics(
  drawing: IDrawing,
  projection: IDrawingProjection,
) {
  'worklet';
  const entry = drawing.points[0].price;
  const target = drawing.points[1]?.price ?? entry;
  const stop = drawing.points[2]?.price ?? entry;
  const direction = drawing.tool === 'shortPosition' ? -1 : 1;
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const accountSize = drawing.accountSize ?? 1000;
  const riskAmount = (accountSize * (drawing.riskPercent ?? 25)) / 100;
  const quantity = risk ? riskAmount / risk : 0;
  const last = drawing.points[1]?.time ?? drawing.points[0].time;
  const startIndex = Math.max(
    0,
    Math.round(indexAtTime(drawing.points[0].time, projection)),
  );
  const endIndex = Math.min(
    projection.points.length - 1,
    Math.round(indexAtTime(last, projection)),
  );
  let exitPrice = projection.points[endIndex]?.c ?? entry;
  let closed = false;
  for (let index = startIndex; index <= endIndex; index += 1) {
    const candle = projection.points[index];
    const stopped = direction === 1 ? candle.l <= stop : candle.h >= stop;
    const reached = direction === 1 ? candle.h >= target : candle.l <= target;
    // Without intrabar trades, count a stop first when both levels are touched in one candle.
    if (stopped || reached) {
      exitPrice = stopped ? stop : target;
      closed = true;
      break;
    }
  }
  return {
    entry,
    target,
    stop,
    risk,
    reward,
    quantity,
    ratio: risk ? reward / risk : 0,
    pnl: (exitPrice - entry) * direction * quantity,
    closed,
    riskAmount,
  };
}

export function getVolumeProfile(
  points: IMarketTokenKLineDataPoint[],
  rows: number,
) {
  'worklet';
  const valid = points.filter(
    (point) =>
      Number.isFinite(point.h) &&
      Number.isFinite(point.l) &&
      Number.isFinite(point.v) &&
      point.v >= 0 &&
      point.h >= point.l,
  );
  if (!valid.length) return null;
  const low = Math.min(...valid.map((point) => point.l));
  const high = Math.max(...valid.map((point) => point.h));
  const count = Math.max(1, Math.min(100, Math.floor(rows)));
  const step =
    (high - low) / count || Math.max(Math.abs(low) * 0.0001, 0.000_001);
  const bins = Array.from({ length: count }, (_, i) => ({
    low: low + i * step,
    high: low + (i + 1) * step,
    up: 0,
    down: 0,
  }));
  for (const candle of valid) {
    const height = candle.h - candle.l;
    if (height === 0) {
      const index = Math.max(
        0,
        Math.min(count - 1, Math.floor((candle.c - low) / step)),
      );
      if (candle.c > candle.o) bins[index].up += candle.v;
      else bins[index].down += candle.v;
    } else
      for (const bin of bins) {
        const volume =
          (candle.v *
            Math.max(
              0,
              Math.min(candle.h, bin.high) - Math.max(candle.l, bin.low),
            )) /
          height;
        if (candle.c > candle.o) bin.up += volume;
        else bin.down += volume;
      }
  }
  return bins;
}

export function appendProjectionGeometry(
  drawing: IDrawing,
  projection: IDrawingProjection,
  geometry: IDrawingGeometry,
) {
  'worklet';
  const { handles, paths, labels } = geometry;
  const [a, second] = handles;
  if (!a) return false;
  const b = second ?? a;
  const c = handles[2] ?? b;
  const rect = (
    left: number,
    right: number,
    top: number,
    bottom: number,
    color: string,
    opacity = 0.2,
  ) => {
    'worklet';
    paths.push({
      points: [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
        { x: left, y: top },
      ],
      color,
      fill: drawing.showBackground !== false,
      fillOpacity: drawing.fillOpacity ?? opacity,
      stroke: false,
    });
  };
  const line = (
    from: IScreenPoint,
    to: IScreenPoint,
    dashed = false,
    color = '#2962FF',
  ) => {
    'worklet';
    paths.push({
      points: extendDrawingLine(
        from,
        to,
        projection,
        drawing.extendLeft ?? false,
        drawing.extendRight ?? false,
      ),
      dashed,
      color,
    });
  };
  const priceY = (price: number) => {
    'worklet';
    return drawingPointToScreen(
      { time: drawing.points[0].time, price },
      projection,
    ).y;
  };
  if (drawing.tool === 'longPosition' || drawing.tool === 'shortPosition') {
    const stats = getPositionStatistics(drawing, projection);
    const right = Math.max(a.x + 16, b.x);
    const targetY = priceY(stats.target);
    const stopY = priceY(stats.stop);
    geometry.handles = [
      a,
      { x: right, y: a.y },
      { x: (a.x + right) / 2, y: targetY },
      { x: (a.x + right) / 2, y: stopY },
    ];
    rect(a.x, right, a.y, targetY, '#089981');
    rect(a.x, right, a.y, stopY, '#F23645');
    line(a, { x: right, y: a.y }, false, drawing.color);
    line({ x: a.x, y: targetY }, { x: right, y: targetY }, false, '#089981');
    line({ x: a.x, y: stopY }, { x: right, y: stopY }, false, '#F23645');
    if (drawing.showLabels !== false) {
      const precision = getDrawingPricePrecision(projection);
      for (const [name, price, value, y, color] of [
        ['Target', stats.target, stats.reward, targetY, '#089981'],
        ['Stop', stats.stop, stats.risk, stopY, '#F23645'],
      ] as const)
        labels.push({
          x: (a.x + right) / 2,
          y: y + (y < a.y ? -8 : 8),
          text: `${name}: ${formatDrawingNumber(price, precision)}\n${formatDrawingNumber(value, precision)} (${stats.entry ? ((value / Math.abs(stats.entry)) * 100).toFixed(2) : '0.00'}%)`,
          fontSize: drawing.fontSize,
          color: '#FFFFFF',
          background: color,
          align: 'center',
          verticalAlign: y < a.y ? 'bottom' : 'top',
          padding: 6,
          radius: 3,
          keepInPane: true,
        });
      labels.push({
        x: (a.x + right) / 2,
        y: a.y,
        text: `${stats.closed ? 'Closed' : 'Open'} P&L: ${formatDrawingNumber(stats.pnl, 2)}\nQty: ${formatDrawingNumber(stats.quantity, 4)}\nRisk/Reward Ratio: ${stats.ratio.toFixed(2)}`,
        color: '#FFFFFF',
        background: stats.pnl >= 0 ? '#089981' : '#F23645',
        fontSize: drawing.fontSize,
        align: 'center',
        verticalAlign: 'middle',
        padding: 6,
        radius: 3,
        keepInPane: true,
      });
    }
    return true;
  }
  if (drawing.tool === 'forecast') {
    line(a, b, false, drawing.color);
    paths.push({ points: drawingArrowHead(a, b, 12) });
    const measurement = getDrawingMeasurement(drawing, projection);
    if (drawing.showLabels !== false)
      labels.push({
        x: b.x,
        y: b.y - 12,
        text: `${formatDrawingNumber(drawing.points[1]?.price ?? drawing.points[0].price, getDrawingPricePrecision(projection))}\n${measurement.priceText}`,
        color: '#FFFFFF',
        background: measurement.delta >= 0 ? '#089981' : '#F23645',
        align: 'center',
        verticalAlign: 'bottom',
        padding: 6,
        radius: 4,
      });
    return true;
  }
  if (drawing.tool === 'projection') {
    const radius = Math.hypot(b.x - a.x, b.y - a.y);
    const start = Math.atan2(b.y - a.y, b.x - a.x);
    let sweep = Math.atan2(c.y - a.y, c.x - a.x) - start;
    if (sweep > Math.PI) sweep -= Math.PI * 2;
    if (sweep < -Math.PI) sweep += Math.PI * 2;
    const arc = Array.from({ length: 65 }, (_, index) => ({
      x: a.x + radius * Math.cos(start + (sweep * index) / 64),
      y: a.y + radius * Math.sin(start + (sweep * index) / 64),
    }));
    paths.push({
      points: [a, ...arc, a],
      fill: drawing.showBackground !== false,
      stroke: drawing.showBorder !== false,
      fillOpacity: drawing.fillOpacity ?? 0.2,
    });
    geometry.handles = [a, b, arc[arc.length - 1]];
    return true;
  }
  if (drawing.tool === 'flatChannel' || drawing.tool === 'disjointChannel') {
    const firstLower = drawing.tool === 'flatChannel' ? { x: a.x, y: c.y } : c;
    const secondLower =
      drawing.tool === 'flatChannel' ? { x: b.x, y: c.y } : (handles[3] ?? c);
    const upper = extendDrawingLine(
      a,
      b,
      projection,
      drawing.extendLeft ?? false,
      drawing.extendRight ?? false,
    );
    const lower = extendDrawingLine(
      firstLower,
      secondLower,
      projection,
      drawing.extendLeft ?? false,
      drawing.extendRight ?? false,
    );
    if (upper.length === 2 && lower.length === 2)
      paths.push({
        points: [upper[0], upper[1], lower[1], lower[0]],
        fill: drawing.showBackground !== false,
        fillOpacity: drawing.fillOpacity ?? 0.2,
        stroke: false,
      });
    paths.push({ points: upper }, { points: lower });
    if (drawing.showMiddleLine !== false)
      line(
        { x: (a.x + firstLower.x) / 2, y: (a.y + firstLower.y) / 2 },
        { x: (b.x + secondLower.x) / 2, y: (b.y + secondLower.y) / 2 },
        true,
        drawing.color,
      );
    return true;
  }
  if (drawing.tool === 'regression' || drawing.tool === 'volumeProfile') {
    const start = Math.max(
      0,
      Math.round(
        Math.min(
          indexAtTime(drawing.points[0].time, projection),
          indexAtTime(
            drawing.points[1]?.time ?? drawing.points[0].time,
            projection,
          ),
        ),
      ),
    );
    const end = Math.min(
      projection.points.length - 1,
      Math.round(
        Math.max(
          indexAtTime(drawing.points[0].time, projection),
          indexAtTime(
            drawing.points[1]?.time ?? drawing.points[0].time,
            projection,
          ),
        ),
      ),
    );
    const candles = projection.points.slice(start, end + 1);
    if (!candles.length && !drawing.volumeProfile?.bins.length) {
      paths.push({ points: [a, b], dashed: true });
      return true;
    }
    if (drawing.tool === 'regression') {
      const n = candles.length;
      const meanX = (n - 1) / 2;
      const meanY = candles.reduce((sum, candle) => sum + candle.c, 0) / n;
      let covariance = 0;
      let variance = 0;
      candles.forEach((candle, index) => {
        covariance += (index - meanX) * (candle.c - meanY);
        variance += (index - meanX) ** 2;
      });
      const slope = variance ? covariance / variance : 0;
      const intercept = meanY - slope * meanX;
      const deviation =
        Math.sqrt(
          candles.reduce(
            (sum, candle, index) =>
              sum + (candle.c - (intercept + slope * index)) ** 2,
            0,
          ) / n,
        ) * (drawing.deviation ?? 2);
      const lines = [-1, 0, 1].map((sign) => [
        drawingPointToScreen(
          { time: candles[0].t, price: intercept + sign * deviation },
          projection,
        ),
        drawingPointToScreen(
          {
            time: candles[n - 1].t,
            price: intercept + slope * (n - 1) + sign * deviation,
          },
          projection,
        ),
      ]);
      geometry.handles = [lines[1][0], lines[1][1]];
      paths.push({
        points: [lines[0][0], lines[0][1], lines[2][1], lines[2][0]],
        fill: drawing.showBackground !== false,
        fillOpacity: drawing.fillOpacity ?? 0.15,
        stroke: false,
      });
      lines.forEach((points, index) =>
        line(points[0], points[1], index === 1, drawing.color),
      );
    } else {
      const bins =
        drawing.volumeProfile?.bins ??
        getVolumeProfile(candles, drawing.profileRows ?? 24);
      if (!bins) return true;
      geometry.handles = [
        { x: a.x, y: priceY(bins[bins.length - 1].high) },
        { x: b.x, y: priceY(bins[0].low) },
      ];
      const maximum = Math.max(...bins.map((bin) => bin.up + bin.down));
      const poc = bins.findIndex((bin) => bin.up + bin.down === maximum);
      const total = bins.reduce((sum, bin) => sum + bin.up + bin.down, 0);
      let areaLow = poc;
      let areaHigh = poc;
      let areaVolume = maximum;
      while (
        areaVolume < (total * (drawing.valueAreaPercent ?? 70)) / 100 &&
        (areaLow > 0 || areaHigh < bins.length - 1)
      ) {
        const below = bins[areaLow - 1];
        const above = bins[areaHigh + 1];
        if (
          above &&
          (!below || above.up + above.down >= below.up + below.down)
        ) {
          areaHigh += 1;
          areaVolume += above.up + above.down;
        } else if (below) {
          areaLow -= 1;
          areaVolume += below.up + below.down;
        }
      }
      const left = Math.min(a.x, b.x);
      const right = Math.max(a.x, b.x);
      bins.forEach((bin, index) => {
        const middle =
          left + (maximum ? bin.up / maximum : 0) * (right - left) * 0.4;
        const endX =
          middle + (maximum ? bin.down / maximum : 0) * (right - left) * 0.4;
        rect(
          left,
          middle,
          priceY(bin.high),
          priceY(bin.low),
          '#2962FF',
          index >= areaLow && index <= areaHigh ? 0.65 : 0.25,
        );
        rect(
          middle,
          endX,
          priceY(bin.high),
          priceY(bin.low),
          '#F7A600',
          index >= areaLow && index <= areaHigh ? 0.65 : 0.25,
        );
      });
      const pocPrice = (bins[poc].low + bins[poc].high) / 2;
      line(
        { x: left, y: priceY(pocPrice) },
        { x: right, y: priceY(pocPrice) },
        false,
        '#F23645',
      );
      for (const price of [bins[areaLow].low, bins[areaHigh].high])
        line(
          { x: left, y: priceY(price) },
          { x: right, y: priceY(price) },
          true,
          '#2962FF',
        );
      if (drawing.showLabels !== false)
        labels.push({
          x: right + 4,
          y: priceY(pocPrice),
          text: `POC ${formatDrawingNumber(pocPrice, getDrawingPricePrecision(projection))}`,
          color: '#F23645',
        });
    }
    return true;
  }
  if (drawing.tool === 'anchoredVwap') {
    const start = Math.max(
      0,
      Math.round(indexAtTime(drawing.points[0].time, projection)),
    );
    let volume = 0;
    let weighted = 0;
    const points: IScreenPoint[] = [];
    for (let i = start; i < projection.points.length; i += 1) {
      const candle = projection.points[i];
      if (Number.isFinite(candle.v) && candle.v > 0) {
        volume += candle.v;
        weighted += ((candle.h + candle.l + candle.c) / 3) * candle.v;
      }
      if (volume)
        points.push(
          drawingPointToScreen(
            { time: candle.t, price: weighted / volume },
            projection,
          ),
        );
    }
    geometry.handles = points.length ? [points[0]] : [a];
    paths.push({ points: points.length ? points : [a] });
    return true;
  }
  if (drawing.tool === 'barsPattern' || drawing.tool === 'ghostFeed') {
    const source =
      drawing.source ??
      projection.points
        .filter(
          (point) =>
            point.t >= drawing.points[0].time &&
            point.t <= (drawing.points[1]?.time ?? drawing.points[0].time),
        )
        .slice(0, 2000);
    if (drawing.tool === 'barsPattern' && source.length) {
      const first = source[0];
      const last = source[source.length - 1];
      const dx = last.t - first.t || projection.interval;
      const originalHeight = last.c - first.c;
      const scaleY = originalHeight
        ? ((drawing.points[1]?.price ?? drawing.points[0].price) -
            drawing.points[0].price) /
          originalHeight
        : 1;
      source.forEach((candle) => {
        const x = a.x + ((candle.t - first.t) / dx) * (b.x - a.x);
        const y = (price: number) => {
          'worklet';
          return priceY(
            drawing.points[0].price +
              (price - first.c) * scaleY * (drawing.reverse ? -1 : 1),
          );
        };
        const color = candle.c >= candle.o ? '#089981' : '#F23645';
        paths.push(
          {
            points: [
              { x, y: y(candle.h) },
              { x, y: y(candle.l) },
            ],
            color,
            width: 1,
          },
          {
            points: [
              { x: x - 3, y: y(candle.o) },
              { x, y: y(candle.o) },
              { x, y: y(candle.c) },
              { x: x + 3, y: y(candle.c) },
            ],
            color,
            width: 1,
          },
        );
      });
    } else if (drawing.tool === 'ghostFeed') {
      const candles = getGhostFeedCandles(drawing, projection);
      for (const candle of candles) {
        const x = drawingPointToScreen(
          { time: candle.t, price: candle.c },
          projection,
        ).x;
        const nextX = drawingPointToScreen(
          {
            time: candle.t + (drawing.sourceInterval ?? projection.interval),
            price: candle.c,
          },
          projection,
        ).x;
        const halfWidth = Math.max(1, Math.min(12, Math.abs(nextX - x) * 0.35));
        const color = candle.c >= candle.o ? '#089981' : '#F23645';
        paths.push({
          points: [
            { x, y: priceY(candle.h) },
            { x, y: priceY(candle.l) },
          ],
          color,
          width: 1,
          opacity: drawing.opacity ?? 0.6,
        });
        rect(
          x - halfWidth,
          x + halfWidth,
          priceY(candle.o),
          priceY(candle.c),
          color,
          drawing.opacity ?? 0.6,
        );
      }
    } else paths.push({ points: [a, b], dashed: true });
    return true;
  }
  return false;
}
