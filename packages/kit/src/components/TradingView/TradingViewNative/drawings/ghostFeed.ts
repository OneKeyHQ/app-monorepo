import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { getDrawingPricePrecision } from './measurement';

import type { IDrawing, IDrawingProjection } from './model';

export function getGhostFeedCandles(
  drawing: IDrawing,
  projection: IDrawingProjection,
): IMarketTokenKLineDataPoint[] {
  'worklet';
  const interval = drawing.sourceInterval ?? projection.interval;
  const tick = 10 ** -getDrawingPricePrecision(projection);
  const averageRange = (drawing.candleRange ?? 50) * tick;
  const variance = (drawing.candleVariance ?? 50) * tick;
  const candles: IMarketTokenKLineDataPoint[] = [];
  const noise = (value: number) => {
    'worklet';
    const wave = Math.sin(value * 12.9898 + 78.233) * 43_758.5453;
    return wave - Math.floor(wave);
  };
  for (
    let segment = 1;
    segment < drawing.points.length && candles.length < 2000;
    segment += 1
  ) {
    const from = drawing.points[segment - 1];
    const to = drawing.points[segment];
    const count = Math.max(
      1,
      Math.min(
        2000 - candles.length,
        Math.round(Math.abs(to.time - from.time) / interval),
      ),
    );
    for (let index = 1; index <= count; index += 1) {
      const progress = index / count;
      const t = from.time + (to.time - from.time) * progress;
      const center =
        from.price +
        (to.price - from.price) * progress +
        (noise(segment * 2000 + index) - 0.5) * variance;
      const range = averageRange * (0.75 + noise(index + segment * 71) * 0.5);
      const body = range * (0.2 + noise(index + segment * 37) * 0.6);
      const rising =
        noise(index + segment * 109) +
          (to.price >= from.price ? 0.25 : -0.25) >=
        0.5;
      candles.push({
        t,
        o: center + (rising ? -body : body) / 2,
        c: center + (rising ? body : -body) / 2,
        h: center + range / 2,
        l: center - range / 2,
        v: 0,
      });
    }
  }
  return candles;
}
