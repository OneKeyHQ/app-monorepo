import {
  TWAP_MAX_DURATION_MINUTES,
  TWAP_MIN_DURATION_MINUTES,
  TWAP_MIN_ORDER_NOTIONAL,
  buildActiveTwapRuntimeInfoByKey,
  formatTwapPriceForDisplay,
  getActiveTwapRuntimeStatus,
  getTwapElapsedMs,
  getTwapTriggerAbove,
  getTwapTriggerReferencePrice,
  isTwapTotalNotionalValid,
  isValidTwapDuration,
} from './hyperliquidTwapUtils';

describe('hyperliquidTwapUtils', () => {
  it('accepts integer durations from 5 minutes through 7 days', () => {
    expect(TWAP_MIN_DURATION_MINUTES).toBe(5);
    expect(TWAP_MAX_DURATION_MINUTES).toBe(10_080);
    expect(isValidTwapDuration(5)).toBe(true);
    expect(isValidTwapDuration(10_080)).toBe(true);
    expect(isValidTwapDuration(4)).toBe(false);
    expect(isValidTwapDuration(10_081)).toBe(false);
    expect(isValidTwapDuration(5.5)).toBe(false);
  });

  it('validates the total order notional instead of estimated slices', () => {
    expect(TWAP_MIN_ORDER_NOTIONAL).toBe(100);
    expect(isTwapTotalNotionalValid({ size: '0.01', price: '10000' })).toBe(
      true,
    );
    expect(isTwapTotalNotionalValid({ size: '0.009999', price: '10000' })).toBe(
      false,
    );
    expect(isTwapTotalNotionalValid({ size: 'invalid', price: '10000' })).toBe(
      false,
    );
  });

  it('derives whether the trigger is above the current mark price', () => {
    expect(getTwapTriggerAbove({ triggerPrice: '101', markPrice: '100' })).toBe(
      true,
    );
    expect(getTwapTriggerAbove({ triggerPrice: '99', markPrice: '100' })).toBe(
      false,
    );
    expect(
      getTwapTriggerAbove({ triggerPrice: '100', markPrice: '100' }),
    ).toBeUndefined();
    expect(
      getTwapTriggerAbove({ triggerPrice: 'invalid', markPrice: '100' }),
    ).toBeUndefined();
  });

  it('uses mark price for perp triggers and mid price for spot triggers', () => {
    expect(
      getTwapTriggerReferencePrice({
        isSpot: false,
        midPrice: '100',
        markPrice: '102',
      }).toFixed(),
    ).toBe('102');
    expect(
      getTwapTriggerReferencePrice({
        isSpot: true,
        midPrice: '100',
        markPrice: '102',
      }).toFixed(),
    ).toBe('100');
  });

  it('does not infer a perp trigger direction without a mark price', () => {
    expect(
      getTwapTriggerReferencePrice({
        isSpot: false,
        midPrice: '100',
      }).isFinite(),
    ).toBe(false);
  });

  it('preserves the wire precision of TWAP prices for display', () => {
    expect(formatTwapPriceForDisplay('0.000012345')).toBe('0.000012345');
    expect(formatTwapPriceForDisplay('12345.678')).toBe('12,345.678');
    expect(formatTwapPriceForDisplay('invalid')).toBe('--');
  });

  it('does not advance running time while waiting for a trigger', () => {
    const timestamp = 1000;
    expect(
      getTwapElapsedMs({
        status: 'waitingForTrigger',
        timestamp,
        now: 61_000,
        minutes: 10,
      }),
    ).toBe(0);
    expect(
      getTwapElapsedMs({
        status: 'activated',
        timestamp,
        now: 61_000,
        minutes: 10,
      }),
    ).toBe(60_000);
    expect(
      getTwapElapsedMs({
        status: 'activated',
        timestamp,
        activatedAt: 31_000,
        now: 61_000,
        minutes: 10,
      }),
    ).toBe(30_000);
    expect(
      getTwapElapsedMs({
        status: 'finished',
        timestamp,
        now: 601_000,
        endTime: 121_000,
        minutes: 10,
      }),
    ).toBe(120_000);
  });

  it('keeps a triggered TWAP pending until history reports activation', () => {
    expect(
      getActiveTwapRuntimeStatus({
        triggerPrice: '101',
        executedSize: '0',
      }),
    ).toBe('waitingForTrigger');
    expect(
      getActiveTwapRuntimeStatus({
        reportedStatus: 'activated',
        triggerPrice: '101',
        executedSize: '0',
      }),
    ).toBe('activated');
    expect(
      getActiveTwapRuntimeStatus({
        reportedStatus: 'waitingForTrigger',
        triggerPrice: '101',
        executedSize: '0.01',
      }),
    ).toBe('activated');
    expect(
      getActiveTwapRuntimeStatus({
        triggerPrice: null,
        executedSize: '0',
      }),
    ).toBe('activated');
  });

  it('keeps the latest reported status and activation time for each TWAP', () => {
    expect(
      buildActiveTwapRuntimeInfoByKey?.([
        {
          time: 1_718_000_000,
          state: { coin: 'ETH', timestamp: 1_717_999_900_000 },
          status: { status: 'waitingForTrigger' },
        },
        {
          time: 1_718_000_120,
          state: { coin: 'ETH', timestamp: 1_717_999_900_000 },
          status: { status: 'activated' },
        },
      ]).get('ETH:1717999900000'),
    ).toEqual({
      reportedStatus: 'activated',
      activatedAt: 1_718_000_120_000,
    });
  });

  it('correlates runtime status when history omits twapId', () => {
    const records = [
      {
        time: 1_718_000_120,
        state: {
          coin: 'ETH',
          timestamp: 1_718_000_000_000,
        },
        status: { status: 'activated' as const },
      },
    ];

    expect(
      Array.from(buildActiveTwapRuntimeInfoByKey(records).entries()),
    ).toEqual([
      [
        'ETH:1718000000000',
        {
          reportedStatus: 'activated',
          activatedAt: 1_718_000_120_000,
        },
      ],
    ]);
  });
});
