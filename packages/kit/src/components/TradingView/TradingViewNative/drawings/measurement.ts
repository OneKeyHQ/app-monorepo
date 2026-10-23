import { formatTradingViewNativePriceTick } from '../utils/chartLayout';
import { formatTradingViewNativeVolume } from '../utils/chartLegend';

import { indexAtTime, timeAtIndex } from './model';

import type { IDrawing, IDrawingProjection } from './model';

export function getDrawingPricePrecision(projection: IDrawingProjection) {
  'worklet';
  const decimals = projection.priceDecimalPlaces;
  if (decimals !== undefined && Number.isFinite(decimals))
    return Math.max(0, Math.min(12, Math.floor(decimals)));
  // Market charts use the same two-decimal / four-significant-fraction price scale as the axis.
  const price = Math.abs(projection.points.at(-1)?.c ?? 0);
  if (price === 0 || price >= 1) return 2;
  return Math.min(12, Math.max(0, -Math.floor(Math.log10(price)) - 1) + 4);
}

export function formatDrawingDuration(seconds: number) {
  'worklet';
  let remaining = Math.round(Math.abs(seconds));
  const parts: string[] = [];
  for (const [size, suffix] of [
    [86_400, 'd'],
    [3600, 'h'],
    [60, 'm'],
    [1, 's'],
  ] as const) {
    const count = Math.floor(remaining / size);
    remaining %= size;
    if (count) parts.push(`${count}${suffix}`);
  }
  return `${seconds < 0 ? '−' : ''}${parts.join(' ') || '0m'}`;
}

export function formatDrawingNumber(value: number, decimals?: number) {
  'worklet';
  const precision =
    decimals === undefined || !Number.isFinite(decimals)
      ? undefined
      : Math.max(0, Math.min(12, Math.floor(decimals)));
  const text =
    precision === undefined
      ? formatTradingViewNativePriceTick(value)
      : value.toFixed(precision);
  const [integer, fraction] = text.split('.');
  const grouped = integer
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    .replace('-', '−');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

export function getDrawingMeasurement(
  drawing: IDrawing,
  projection: IDrawingProjection,
) {
  'worklet';
  const from = drawing.points[0];
  const to = drawing.points[1] ?? from;
  const startIndex = Math.round(indexAtTime(from.time, projection));
  const endIndex = Math.round(indexAtTime(to.time, projection));
  const delta = to.price - from.price;
  const percent = from.price ? (delta / Math.abs(from.price)) * 100 : 0;
  let volume = 0;
  for (
    let index = Math.max(0, Math.min(startIndex, endIndex));
    index <=
    Math.min(projection.points.length - 1, Math.max(startIndex, endIndex));
    index += 1
  ) {
    const value = projection.points[index].v;
    if (Number.isFinite(value) && value > 0) volume += value;
  }
  const precision = getDrawingPricePrecision(projection);
  const ticks = ` ${formatDrawingNumber(Math.round(delta * 10 ** precision), 0)}`;
  return {
    delta,
    bars: endIndex - startIndex,
    volume,
    priceText: `${formatDrawingNumber(delta, precision)} (${percent.toFixed(2).replace('-', '−')}%)${ticks}`,
    timeText: `${endIndex - startIndex} bars, ${formatDrawingDuration(timeAtIndex(endIndex, projection) - timeAtIndex(startIndex, projection))}`,
    volumeText: `Vol ${formatTradingViewNativeVolume(volume)}`,
  };
}
