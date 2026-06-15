import {
  assertValidScaleOrderLegs,
  buildScaleOrderLegs,
  getReduceOnlyOrderGuardError,
  getReduceOnlyPositionMaxSize,
  getReduceOnlyPositionSnapshotError,
  getScaleOrderPriceBounds,
  getScaleOrderReferencePrice,
  getScaleOrderSizeSkew,
  normalizeScaleOrderCount,
  validateScaleOrderLegs,
} from './hyperliquidScaleOrderUtils';

describe('hyperliquidScaleOrderUtils', () => {
  test('normalizes only integer order counts', () => {
    expect(normalizeScaleOrderCount('2')).toBe(2);
    expect(normalizeScaleOrderCount(100)).toBe(100);
    expect(normalizeScaleOrderCount('2.5')).toBe(0);
    expect(normalizeScaleOrderCount('abc')).toBe(0);
  });

  test('normalizes price bounds and reference price', () => {
    const bounds = getScaleOrderPriceBounds({
      lowerPrice: '20',
      upperPrice: '10',
    });
    expect(bounds.lowerPrice.toFixed()).toBe('10');
    expect(bounds.upperPrice.toFixed()).toBe('20');
    expect(
      getScaleOrderReferencePrice({
        startPrice: '10',
        endPrice: '20',
      }).toFixed(),
    ).toBe('15');
    expect(
      getScaleOrderReferencePrice({
        lowerPrice: 'bad',
        upperPrice: '20',
      }).toFixed(),
    ).toBe('0');
  });

  test('builds long scale legs from high to low with even sizes', () => {
    expect(
      buildScaleOrderLegs({
        totalSize: '6',
        lowerPrice: '10',
        upperPrice: '20',
        orderCount: 3,
        szDecimals: 2,
        side: 'long',
      }),
    ).toEqual([
      { index: 0, price: '20', size: '2' },
      { index: 1, price: '15', size: '2' },
      { index: 2, price: '10', size: '2' },
    ]);
  });

  test('builds short scale legs from low to high', () => {
    expect(
      buildScaleOrderLegs({
        totalSize: '6',
        lowerPrice: '10',
        upperPrice: '20',
        orderCount: 3,
        szDecimals: 2,
        side: 'short',
      }).map((leg) => leg.price),
    ).toEqual(['10', '15', '20']);
  });

  test('builds increasing scale sizes toward better prices', () => {
    expect(
      buildScaleOrderLegs({
        totalSize: '12',
        lowerPrice: '70',
        upperPrice: '100',
        orderCount: 4,
        szDecimals: 2,
        side: 'long',
        sizeSkew: getScaleOrderSizeSkew('increasing'),
      }),
    ).toEqual([
      { index: 0, price: '100', size: '2' },
      { index: 1, price: '90', size: '2.66' },
      { index: 2, price: '80', size: '3.33' },
      { index: 3, price: '70', size: '4.01' },
    ]);

    expect(
      buildScaleOrderLegs({
        totalSize: '12',
        lowerPrice: '70',
        upperPrice: '100',
        orderCount: 4,
        szDecimals: 2,
        side: 'short',
        sizeSkew: getScaleOrderSizeSkew('increasing'),
      }),
    ).toEqual([
      { index: 0, price: '70', size: '2' },
      { index: 1, price: '80', size: '2.66' },
      { index: 2, price: '90', size: '3.33' },
      { index: 3, price: '100', size: '4.01' },
    ]);
  });

  test('falls back to fixed sizes for invalid size skew', () => {
    expect(
      buildScaleOrderLegs({
        totalSize: '6',
        lowerPrice: '10',
        upperPrice: '20',
        orderCount: 3,
        szDecimals: 2,
        side: 'long',
        sizeSkew: 0,
      }).map((leg) => leg.size),
    ).toEqual(['2', '2', '2']);
  });

  test('keeps rounded size remainder on the last leg', () => {
    expect(
      buildScaleOrderLegs({
        totalSize: '1',
        lowerPrice: '30',
        upperPrice: '30.2',
        orderCount: 3,
        szDecimals: 2,
        side: 'long',
      }).map((leg) => leg.size),
    ).toEqual(['0.33', '0.33', '0.34']);
  });

  test('formats spot scale prices with spot precision', () => {
    expect(
      buildScaleOrderLegs({
        totalSize: '30',
        lowerPrice: '0.1234',
        upperPrice: '0.1334',
        orderCount: 2,
        szDecimals: 6,
        side: 'long',
        assetType: 'spot',
      }).map((leg) => leg.price),
    ).toEqual(['0.13', '0.12']);
  });

  test('returns no legs for invalid scale order inputs', () => {
    const validInput = {
      totalSize: '6',
      lowerPrice: '10',
      upperPrice: '20',
      orderCount: 3,
      szDecimals: 2,
      side: 'long' as const,
    };

    expect(buildScaleOrderLegs({ ...validInput, orderCount: 1 })).toHaveLength(
      0,
    );
    expect(
      buildScaleOrderLegs({ ...validInput, orderCount: 101 }),
    ).toHaveLength(0);
    expect(buildScaleOrderLegs({ ...validInput, totalSize: '0' })).toHaveLength(
      0,
    );
    expect(
      buildScaleOrderLegs({ ...validInput, lowerPrice: '20' }),
    ).toHaveLength(0);
    expect(
      buildScaleOrderLegs({ ...validInput, upperPrice: 'bad' }),
    ).toHaveLength(0);
  });

  test('rejects legs below notional minimum or collapsed price precision', () => {
    const tinyLegs = buildScaleOrderLegs({
      totalSize: '0.03',
      lowerPrice: '100',
      upperPrice: '110',
      orderCount: 3,
      szDecimals: 4,
      side: 'long',
    });
    expect(validateScaleOrderLegs({ legs: tinyLegs }).isValid).toBe(false);
    expect(validateScaleOrderLegs({ legs: tinyLegs }).errors[0]).toBe(
      'Leg 1: notional must be at least $10',
    );
    expect(validateScaleOrderLegs({ legs: tinyLegs }).issues[0]).toEqual({
      code: 'minNotionalTooSmall',
      legIndex: 0,
      minNotional: '10',
    });

    const collapsedPriceLegs = buildScaleOrderLegs({
      totalSize: '100',
      lowerPrice: '1.00001',
      upperPrice: '1.00002',
      orderCount: 3,
      szDecimals: 5,
      side: 'long',
    });
    expect(validateScaleOrderLegs({ legs: collapsedPriceLegs })).toEqual({
      isValid: false,
      errors: ['Price range is too tight for this market precision'],
      issues: [{ code: 'priceRangeTooTight', legIndex: 1 }],
    });
  });

  test('reports malformed scale legs', () => {
    expect(
      validateScaleOrderLegs({
        legs: [{ index: 0, price: 'bad', size: '1' }],
      }),
    ).toEqual({
      isValid: false,
      errors: ['Leg 1: invalid price'],
      issues: [{ code: 'invalidPrice', legIndex: 0 }],
    });
    expect(
      validateScaleOrderLegs({
        legs: [{ index: 0, price: '20', size: 'bad' }],
      }),
    ).toEqual({
      isValid: false,
      errors: ['Leg 1: size is too small'],
      issues: [{ code: 'sizeTooSmall', legIndex: 0 }],
    });
  });

  test('throws the first scale validation error', () => {
    expect(() => assertValidScaleOrderLegs({ legs: [] })).toThrow(
      'Invalid scale order parameters',
    );
  });

  test('guards deterministic reduce-only position violations', () => {
    expect(
      getReduceOnlyPositionSnapshotError({
        reduceOnly: true,
        accountAddress: '0xabc',
        positionsAccountAddress: undefined,
      }),
    ).toBe('Reduce-only position data unavailable, please try again');

    expect(
      getReduceOnlyPositionSnapshotError({
        reduceOnly: true,
        accountAddress: '0xAbC',
        positionsAccountAddress: '0xabc',
      }),
    ).toBeUndefined();

    expect(
      getReduceOnlyPositionSnapshotError({
        reduceOnly: false,
        accountAddress: undefined,
        positionsAccountAddress: undefined,
      }),
    ).toBeUndefined();

    expect(
      getReduceOnlyOrderGuardError({
        reduceOnly: false,
        side: 'long',
        size: '10',
        positionSize: '0',
      }),
    ).toBeUndefined();
    expect(
      getReduceOnlyOrderGuardError({
        reduceOnly: true,
        side: 'long',
        size: '1',
        positionSize: '-2',
      }),
    ).toBeUndefined();
    expect(
      getReduceOnlyOrderGuardError({
        reduceOnly: true,
        side: 'short',
        size: '1',
        positionSize: '2',
      }),
    ).toBeUndefined();
    expect(
      getReduceOnlyOrderGuardError({
        reduceOnly: true,
        side: 'long',
        size: '1',
        positionSize: '2',
      }),
    ).toBe('Reduce-only order requires an opposite open position');
    expect(
      getReduceOnlyOrderGuardError({
        reduceOnly: true,
        side: 'short',
        size: '3',
        positionSize: '2',
      }),
    ).toBe('Reduce-only order size exceeds the current position');
  });

  test('resolves reduce-only slider max from the opposite position size', () => {
    expect(
      getReduceOnlyPositionMaxSize({
        reduceOnly: true,
        side: 'short',
        positionSize: '37.123',
        szDecimals: 2,
      })?.toFixed(),
    ).toBe('37.12');

    expect(
      getReduceOnlyPositionMaxSize({
        reduceOnly: true,
        side: 'long',
        positionSize: '-12.345',
        szDecimals: 2,
      })?.toFixed(),
    ).toBe('12.34');

    expect(
      getReduceOnlyPositionMaxSize({
        reduceOnly: true,
        side: 'long',
        positionSize: '12.345',
        szDecimals: 2,
      }),
    ).toBeUndefined();

    expect(
      getReduceOnlyPositionMaxSize({
        reduceOnly: false,
        side: 'short',
        positionSize: '37.123',
        szDecimals: 2,
      }),
    ).toBeUndefined();
  });
});
