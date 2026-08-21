import type { IFundingHistoryRecord } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  buildPerpFundingChartData,
  getPerpFundingChartHistoryRange,
  getPerpFundingTooltipPosition,
} from './fundingChart';

const HOUR_MS = 60 * 60 * 1000;

function record(hour: number, fundingRate: string): IFundingHistoryRecord {
  return {
    coin: 'BTC',
    fundingRate,
    premium: '0',
    time: hour * HOUR_MS,
  };
}

describe('buildPerpFundingChartData', () => {
  it('keeps hourly rates and calculates a running cumulative rate', () => {
    const result = buildPerpFundingChartData(
      [record(2, '-0.00002'), record(0, '0.00001'), record(1, '0.00003')],
      '1h',
    );

    expect(result).toEqual([
      { time: 0, fundingRate: 0.001, cumulativeFundingRate: 0.001 },
      { time: 3600, fundingRate: 0.003, cumulativeFundingRate: 0.004 },
      { time: 7200, fundingRate: -0.002, cumulativeFundingRate: 0.002 },
    ]);
  });

  it('sums hourly rates into UTC-aligned 8-hour buckets', () => {
    const result = buildPerpFundingChartData(
      [record(7, '0.00001'), record(8, '0.00003'), record(1, '0.00002')],
      '8h',
    );

    expect(result).toEqual([
      { time: 0, fundingRate: 0.003, cumulativeFundingRate: 0.003 },
      {
        time: 8 * 3600,
        fundingRate: 0.003,
        cumulativeFundingRate: 0.006,
      },
    ]);
  });

  it('uses 24-hour UTC buckets for the daily view and ignores invalid rates', () => {
    const result = buildPerpFundingChartData(
      [record(23, '0.0001'), record(24, '-0.00004'), record(25, 'invalid')],
      '1d',
    );

    expect(result).toEqual([
      { time: 0, fundingRate: 0.01, cumulativeFundingRate: 0.01 },
      {
        time: 24 * 3600,
        fundingRate: -0.004,
        cumulativeFundingRate: 0.006,
      },
    ]);
  });

  it.each([
    ['1h', 7 * 24, '7d'],
    ['8h', 30 * 24, '30d'],
    ['1d', 90 * 24, '90d'],
  ] as const)(
    'limits the %s interval to its %s-hour history range',
    (interval, rangeHours, historyRange) => {
      const latestHour = 100 * 24;
      const result = buildPerpFundingChartData(
        [
          record(latestHour - rangeHours - 1, '0.00001'),
          record(latestHour - rangeHours, '0.00002'),
          record(latestHour, '0.00003'),
        ],
        interval,
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.time).toBe((latestHour - rangeHours) * 3600);
      expect(result.at(-1)?.cumulativeFundingRate).toBeCloseTo(0.005);
      expect(getPerpFundingChartHistoryRange(interval)).toBe(historyRange);
    },
  );
});

describe('getPerpFundingTooltipPosition', () => {
  const chartSize = {
    chartWidth: 800,
    chartHeight: 400,
    tooltipWidth: 280,
    tooltipHeight: 96,
  };

  it('places the tooltip to the right of the crosshair when there is room', () => {
    expect(
      getPerpFundingTooltipPosition({
        ...chartSize,
        x: 200,
        y: 200,
      }),
    ).toEqual({ left: 212, top: 152 });
  });

  it('accounts for a left price scale before placing the tooltip', () => {
    expect(
      getPerpFundingTooltipPosition({
        ...chartSize,
        x: 136,
        y: 200,
        leftPriceScaleWidth: 64,
      }),
    ).toEqual({ left: 212, top: 152 });
  });

  it('flips the tooltip to the left near the right chart edge', () => {
    expect(
      getPerpFundingTooltipPosition({
        ...chartSize,
        x: 780,
        y: 200,
      }),
    ).toEqual({ left: 488, top: 152 });
  });

  it('keeps the tooltip within the vertical chart bounds', () => {
    expect(
      getPerpFundingTooltipPosition({
        ...chartSize,
        x: 200,
        y: 10,
      }),
    ).toEqual({ left: 212, top: 8 });
    expect(
      getPerpFundingTooltipPosition({
        ...chartSize,
        x: 200,
        y: 390,
      }),
    ).toEqual({ left: 212, top: 296 });
  });
});
