import type { IUserFunding } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  buildPositionCumulativeFundingChartData,
  buildPositionFundingProjection,
  formatPositionFundingDateTime,
} from './positionFundingUtils';

const NOW = Date.UTC(2026, 7, 25, 8);

function createFunding({
  coin,
  time,
  usdc,
}: {
  coin: string;
  time: number;
  usdc: string;
}): IUserFunding {
  return {
    time,
    hash: `0x${'0'.repeat(64)}`,
    delta: {
      type: 'funding',
      coin,
      usdc,
      szi: '1',
      fundingRate: '0.0001',
      nSamples: null,
    },
  };
}

describe('buildPositionFundingProjection', () => {
  it('projects a positive funding rate as a payment for a long position', () => {
    expect(
      buildPositionFundingProjection({
        signedSize: '2',
        oraclePrice: '100',
        fundingRate: '0.001',
      }),
    ).toEqual({
      currentRate: '0.001',
      currentPayment: '-0.2',
      next24hRate: '0.024',
      next24hPayment: '-4.8',
      annualizedRate: '8.76',
      annualizedPayment: '-1752',
    });
  });

  it('projects the same positive rate as income for a short position', () => {
    expect(
      buildPositionFundingProjection({
        signedSize: '-2',
        oraclePrice: '100',
        fundingRate: '0.001',
        fundingIntervalHours: 2,
      }),
    ).toEqual({
      currentRate: '0.001',
      currentPayment: '0.2',
      next24hRate: '0.012',
      next24hPayment: '2.4',
      annualizedRate: '4.38',
      annualizedPayment: '876',
    });
  });

  it('rejects invalid projection inputs', () => {
    expect(
      buildPositionFundingProjection({
        signedSize: 'invalid',
        oraclePrice: '100',
        fundingRate: '0.001',
      }),
    ).toBeNull();
  });
});

describe('formatPositionFundingDateTime', () => {
  const timestampSeconds = Date.UTC(2026, 7, 24, 9) / 1000;

  it('uses the supplied time zone with a fixed date-time layout', () => {
    expect(
      formatPositionFundingDateTime({
        timestampSeconds,
        timeZone: 'Asia/Shanghai',
      }),
    ).toBe('2026-08-24 17:00');
  });

  it('does not treat the timestamp as local time before applying the zone', () => {
    expect(
      formatPositionFundingDateTime({
        timestampSeconds,
        timeZone: 'Etc/UTC',
      }),
    ).toBe('2026-08-24 09:00');
  });
});

describe('buildPositionCumulativeFundingChartData', () => {
  it('keeps the account history scoped to the exact API coin', () => {
    const result = buildPositionCumulativeFundingChartData({
      records: [
        createFunding({ coin: 'BTC', time: NOW - 2000, usdc: '-1' }),
        createFunding({ coin: 'xyz:BTC', time: NOW - 1000, usdc: '5' }),
      ],
      coin: 'BTC',
      timePeriod: 'allTime',
      now: NOW,
    });

    expect(result.total).toBe(-1);
    expect(result.chartData.at(-1)).toEqual([Math.floor(NOW / 1000), -1]);
  });
});
