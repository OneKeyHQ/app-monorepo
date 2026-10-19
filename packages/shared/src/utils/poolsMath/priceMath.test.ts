import {
  alignTick,
  displayPriceToTick,
  getDisplayRange,
  getFullRange,
  getMaxUsableTick,
  getMinUsableTick,
  getRangeAroundPrice,
  isFullRange,
  isPoolPriceInverted,
  isTickInRange,
  priceToSqrtRatioX96,
  priceToTick,
  sqrtRatioX96ToPrice,
  stepDisplayBound,
  tickToPrice,
} from './priceMath';

// USDC (6 decimals) is token0 and WETH (18) token1: price is WETH per USDC
const USDC_WETH = { decimals0: 6, decimals1: 18 };

describe('prices and ticks', () => {
  it('applies the decimals factor (doc §3.3)', () => {
    expect(
      tickToPrice({ tick: 0, decimals0: 18, decimals1: 18 }).toNumber(),
    ).toBe(1);
    // 1.0001^0 × 10^(6 − 18)
    expect(tickToPrice({ tick: 0, ...USDC_WETH }).toNumber()).toBeCloseTo(
      1e-12,
      20,
    );
  });

  it('round-trips a price through its tick', () => {
    const price = 1 / 3400;
    const tick = priceToTick({ price, ...USDC_WETH });
    // Real USDC/WETH pools sit around tick 195,000
    expect(tick).toBe(195_004);
    expect(tickToPrice({ tick, ...USDC_WETH }).lte(price)).toBe(true);
    expect(tickToPrice({ tick: tick + 1, ...USDC_WETH }).gt(price)).toBe(true);
  });

  it('converts sqrtPriceX96 both ways', () => {
    const sqrtRatioX96 = priceToSqrtRatioX96({
      price: '400',
      decimals0: 18,
      decimals1: 18,
    });
    const price = sqrtRatioX96ToPrice({
      sqrtRatioX96,
      decimals0: 18,
      decimals1: 18,
    });
    expect(price.minus(400).abs().lt('1e-20')).toBe(true);
  });
});

describe('tick alignment', () => {
  it('floors below zero instead of truncating', () => {
    expect(alignTick({ tick: -5, tickSpacing: 10, mode: 'down' })).toBe(-10);
    expect(alignTick({ tick: -5, tickSpacing: 10, mode: 'up' })).toBe(0);
    expect(alignTick({ tick: -6, tickSpacing: 10 })).toBe(-10);
    expect(Object.is(alignTick({ tick: -4, tickSpacing: 10 }), 0)).toBe(true);
  });

  it('stays inside the usable ticks', () => {
    expect(getMinUsableTick(60)).toBe(-887_220);
    expect(getMaxUsableTick(60)).toBe(887_220);
    expect(alignTick({ tick: 887_272, tickSpacing: 60, mode: 'up' })).toBe(
      887_220,
    );
    expect(isFullRange({ ...getFullRange(60), tickSpacing: 60 })).toBe(true);
  });

  it('uses the contract rule for in range', () => {
    expect(isTickInRange({ tickLower: -60, tickUpper: 60, tick: -60 })).toBe(
      true,
    );
    expect(isTickInRange({ tickLower: -60, tickUpper: 60, tick: 60 })).toBe(
      false,
    );
  });
});

describe('range presets', () => {
  const pool = {
    sqrtRatioX96: priceToSqrtRatioX96({
      price: '400',
      decimals0: 18,
      decimals1: 18,
    }),
    tickSpacing: 60,
    decimals0: 18,
    decimals1: 18,
  };

  it('brackets the price within one spacing of ±percent', () => {
    const range = getRangeAroundPrice({ ...pool, percent: 0.1 });
    expect(range.tickLower % 60).toBe(0);
    expect(range.tickUpper % 60).toBe(0);
    const lower = tickToPrice({ tick: range.tickLower, ...pool }).toNumber();
    const upper = tickToPrice({ tick: range.tickUpper, ...pool }).toNumber();
    // One spacing of 60 ticks is about 0.6% of price
    expect(lower).toBeGreaterThan(360 * 0.994);
    expect(lower).toBeLessThan(360 * 1.006);
    expect(upper).toBeGreaterThan(440 * 0.994);
    expect(upper).toBeLessThan(440 * 1.006);
  });

  it('keeps the current price inside even when the grid is coarse', () => {
    const range = getRangeAroundPrice({
      ...pool,
      percent: 0.001,
      tickSpacing: 200,
    });
    const currentTick = priceToTick({ price: '400', ...pool });
    expect(isTickInRange({ ...range, tick: currentTick })).toBe(true);
  });
});

describe('display direction', () => {
  const range = { tickLower: -600, tickUpper: 600 };
  const context = { ...range, tickSpacing: 60, decimals0: 18, decimals1: 18 };

  it('swaps the ends when inverted', () => {
    const normal = getDisplayRange({ ...context, inverted: false });
    const inverted = getDisplayRange({ ...context, inverted: true });
    expect(inverted.min.toNumber()).toBeCloseTo(1 / normal.max.toNumber(), 12);
    expect(inverted.max.toNumber()).toBeCloseTo(1 / normal.min.toNumber(), 12);
  });

  it('maps a typed inverted price to the matching pool tick', () => {
    const upperPrice = tickToPrice({ tick: 600, decimals0: 18, decimals1: 18 });
    const tick = displayPriceToTick({
      displayPrice: upperPrice.pow(-1),
      inverted: true,
      tickSpacing: 60,
      decimals0: 18,
      decimals1: 18,
    });
    expect(tick).toBe(600);
  });

  it('steps a displayed bound the right way when inverted', () => {
    // Raising the displayed minimum lowers the pool's upper tick
    expect(
      stepDisplayBound({
        range,
        bound: 'min',
        direction: 'up',
        inverted: true,
        tickSpacing: 60,
      }),
    ).toEqual({ tickLower: -600, tickUpper: 540 });
    expect(
      stepDisplayBound({
        range,
        bound: 'min',
        direction: 'up',
        inverted: false,
        tickSpacing: 60,
      }),
    ).toEqual({ tickLower: -540, tickUpper: 600 });
  });

  it('refuses a step that would cross the other bound', () => {
    const narrow = { tickLower: 0, tickUpper: 60 };
    expect(
      stepDisplayBound({
        range: narrow,
        bound: 'min',
        direction: 'up',
        inverted: false,
        tickSpacing: 60,
      }),
    ).toEqual(narrow);
  });
});

describe('quote asset', () => {
  const usdc = { category: 'stablecoin', canonicalId: 'evm--1:0xa0b8' };
  const weth = { canonicalId: 'evm--1:ETH' };
  const wbtc = { canonicalId: 'evm--1:0x2260' };

  it('quotes in a stablecoin, then ETH, then token1', () => {
    expect(isPoolPriceInverted({ token0: usdc, token1: weth })).toBe(true);
    expect(isPoolPriceInverted({ token0: weth, token1: usdc })).toBe(false);
    expect(isPoolPriceInverted({ token0: wbtc, token1: weth })).toBe(false);
    expect(isPoolPriceInverted({ token0: weth, token1: wbtc })).toBe(true);
    expect(isPoolPriceInverted({ token0: usdc, token1: usdc })).toBe(false);
  });
});
