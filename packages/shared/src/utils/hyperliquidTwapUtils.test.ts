import BigNumber from 'bignumber.js';

import {
  buildActiveTwapRuntimeInfoByKey,
  formatTwapEstimatedSliceSize,
  formatTwapMinimumOrderNotional,
  formatTwapPriceForDisplay,
  formatTwapPriceForOrder,
  getActiveTwapRuntimeStatus,
  getTwapElapsedMs,
  getTwapEstimatedSliceSize,
  getTwapTriggerAbove,
  isTerminalTwapStatus,
  isTwapStopPriceValid,
  isTwapTotalNotionalValid,
  isValidTwapDuration,
} from './hyperliquidTwapUtils';

describe('hyperliquidTwapUtils', () => {
  it.each([
    ['79.905', 2, '100.69'],
    ['1843.5', 4, '100.11'],
    ['80000', 5, '100.00'],
  ])(
    'suggests an amount that remains valid after size truncation at price %s',
    (price, szDecimals, expectedAmount) => {
      const amount = formatTwapMinimumOrderNotional({ price, szDecimals });
      expect(amount).toBe(expectedAmount);
      expect(
        isTwapTotalNotionalValid({
          size: new BigNumber(amount).dividedBy(price),
          price,
          szDecimals,
        }),
      ).toBe(true);
      expect(
        isTwapTotalNotionalValid({
          size: new BigNumber(amount).minus('0.01').dividedBy(price),
          price,
          szDecimals,
        }),
      ).toBe(false);
    },
  );

  it.each(['0', '-1', 'NaN', 'Infinity'])(
    'keeps the base minimum in the error message for unavailable price %s',
    (price) => {
      expect(formatTwapMinimumOrderNotional({ price, szDecimals: 2 })).toBe(
        '100',
      );
    },
  );

  const estimate = {
    size: '1',
    midPrice: '10000',
    szDecimals: 4,
    durationMinutes: 60,
  };

  it.each([
    ['1', '10000', 60, '0.00826446'],
    ['1', '20000', 5760, '0.00050000'],
    ['0.012199', '10000', 5, '0.00110000'],
    ['0.0005', '10000', 5, '0.00050000'],
  ])(
    'estimates coin quantity with the slice interval, floor, truncation and cap: %s/%s/%s',
    (size, midPrice, durationMinutes, expected) => {
      expect(
        getTwapEstimatedSliceSize({
          ...estimate,
          size,
          midPrice,
          durationMinutes,
        })?.toFixed(8),
      ).toBe(expected);
    },
  );

  it('formats the coin quantity and distinguishes zero from an unavailable estimate', () => {
    const params = { ...estimate, symbol: 'BTC', durationMinutes: 5760 };
    expect(formatTwapEstimatedSliceSize(params)).toBe('≈ 0.001 BTC');
    expect(
      formatTwapEstimatedSliceSize({ ...params, size: '0', midPrice: '0' }),
    ).toBe('≈ 0 BTC');
    expect(
      formatTwapEstimatedSliceSize({ ...params, midPrice: '0' }),
    ).toBeUndefined();
    expect(
      formatTwapEstimatedSliceSize({ ...params, midPrice: 'NaN' }),
    ).toBeUndefined();
    expect(
      formatTwapEstimatedSliceSize({ ...params, durationMinutes: 4 }),
    ).toBeUndefined();
  });

  it('accepts integer durations from five minutes through seven days', () => {
    expect([5, 10_080, 4, 10_081, 5.5].map(isValidTwapDuration)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });

  it.each([
    ['0.054246', '1843.5', 4, false],
    ['0.010099', '10000', 3, true],
    ['0', '100', 4, false],
    ['1', 'NaN', 4, false],
  ])(
    'checks the 100 USDC minimum after wire truncation: %s/%s/%s',
    (size, price, szDecimals, valid) => {
      expect(isTwapTotalNotionalValid({ size, price, szDecimals })).toBe(valid);
    },
  );

  it('derives trigger direction and rejects equal or invalid prices', () => {
    expect(
      ['101', '99', '100', 'invalid'].map((triggerPrice) =>
        getTwapTriggerAbove({ triggerPrice, markPrice: '100' }),
      ),
    ).toEqual([true, false, undefined, undefined]);
  });

  it.each([
    [true, '101', undefined, true],
    [false, '99', undefined, true],
    [true, '95', '90', true],
    [false, '105', '110', true],
    [true, '105', '110', false],
    [false, '95', '90', false],
  ])(
    'validates buy/sell stops against the activation boundary: %s/%s/%s',
    (isBuy, stopPrice, triggerPrice, valid) => {
      expect(
        isTwapStopPriceValid({
          isBuy,
          stopPrice,
          triggerPrice,
          referencePrice: '100',
        }),
      ).toBe(valid);
    },
  );

  it('formats wire prices before validation and preserves precision for display', () => {
    expect(
      formatTwapPriceForOrder({
        price: '123450.5',
        szDecimals: 5,
        assetType: 'perp',
      }),
    ).toBe('123450');
    expect(
      formatTwapPriceForOrder({
        price: '0.123456',
        szDecimals: 2,
        assetType: 'spot',
      }),
    ).toBe('0.12345');
    expect(formatTwapPriceForDisplay('0.000012345')).toBe('0.000012345');
    expect(formatTwapPriceForDisplay('12345.678')).toBe('12,345.678');
    expect(formatTwapPriceForDisplay('invalid')).toBe('--');
  });

  it('keeps triggered orders waiting until activation or a fill is reported', () => {
    const params = { triggerPrice: '101', executedSize: '0' };
    expect(getActiveTwapRuntimeStatus(params)).toBe('waitingForTrigger');
    expect(
      getActiveTwapRuntimeStatus({ ...params, reportedStatus: 'activated' }),
    ).toBe('activated');
    expect(
      getActiveTwapRuntimeStatus({
        ...params,
        reportedStatus: 'waitingForTrigger',
        executedSize: '0.1',
      }),
    ).toBe('activated');
    expect(getActiveTwapRuntimeStatus({ ...params, triggerPrice: null })).toBe(
      'activated',
    );
  });

  it('starts elapsed time at activation and caps it at the configured duration', () => {
    const clock = { timestamp: 1000, now: 1_201_000, minutes: 10 };
    expect(getTwapElapsedMs({ ...clock, status: 'waitingForTrigger' })).toBe(0);
    expect(getTwapElapsedMs(clock)).toBe(600_000);
    expect(getTwapElapsedMs({ ...clock, now: 61_000 })).toBe(60_000);
    expect(getTwapElapsedMs({ ...clock, triggerPrice: '101' })).toBeUndefined();
    expect(
      getTwapElapsedMs({
        ...clock,
        triggerPrice: '101',
        activatedAt: 1_171_000,
      }),
    ).toBe(30_000);
    expect(getTwapElapsedMs({ ...clock, endTime: 121_000 })).toBe(120_000);
  });

  it.each(['stopped', 'finished', 'terminated', 'error'] as const)(
    'keeps the latest %s status and activation time despite an out-of-order active snapshot',
    (terminalStatus) => {
      const state = { coin: 'ETH', timestamp: 1_718_000_000_000 };
      const info = buildActiveTwapRuntimeInfoByKey([
        { state, time: 1_718_000_180, status: { status: terminalStatus } },
        { state, time: 1_718_000_120, status: { status: 'activated' } },
        { state, time: 1_718_000_000, status: { status: 'waitingForTrigger' } },
        {
          state: { ...state, coin: 'BTC' },
          time: 1_718_000_200_000,
          status: { status: 'activated' },
        },
      ]);
      expect(info.get('ETH:1718000000000')).toEqual({
        reportedStatus: terminalStatus,
        activatedAt: 1_718_000_120_000,
      });
      expect(info.get('BTC:1718000000000')?.activatedAt).toBe(
        1_718_000_200_000,
      );
      expect(
        isTerminalTwapStatus(info.get('ETH:1718000000000')?.reportedStatus),
      ).toBe(true);
      expect(
        getActiveTwapRuntimeStatus({
          reportedStatus: terminalStatus,
          triggerPrice: '101',
          executedSize: '0.1',
        }),
      ).toBe(terminalStatus);
    },
  );

  it('does not filter active, waiting or unknown statuses as terminal', () => {
    expect(
      ([undefined, 'activated', 'waitingForTrigger'] as const).map(
        isTerminalTwapStatus,
      ),
    ).toEqual([false, false, false]);
  });
});
