import type { IEventCandleParameters } from '@onekeyhq/shared/types/hyperliquid/sdk';

export type IHyperLiquidCandleInterval = IEventCandleParameters['interval'];

const TRADINGVIEW_HL_NUMERIC_INTERVAL_MAP: Record<
  string,
  IHyperLiquidCandleInterval
> = {
  '1': '1m',
  '3': '3m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '120': '2h',
  '240': '4h',
  '480': '8h',
  '720': '12h',
  D: '1d',
  W: '1w',
  M: '1M',
  '1D': '1d',
  '1W': '1w',
  '1M': '1M',
};

const HYPERLIQUID_INTERVALS = new Set<IHyperLiquidCandleInterval>([
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
]);

function isHyperLiquidInterval(
  interval?: string,
): interval is IHyperLiquidCandleInterval {
  return HYPERLIQUID_INTERVALS.has(interval as IHyperLiquidCandleInterval);
}

export function getHyperLiquidInterval(
  resolution?: string,
): IHyperLiquidCandleInterval {
  const normalizedResolution = resolution?.trim();
  const interval =
    TRADINGVIEW_HL_NUMERIC_INTERVAL_MAP[normalizedResolution || ''] ||
    normalizedResolution
      ?.replace(/H$/, 'h')
      .replace(/D$/, 'd')
      .replace(/W$/, 'w');
  return isHyperLiquidInterval(interval) ? interval : '1m';
}
