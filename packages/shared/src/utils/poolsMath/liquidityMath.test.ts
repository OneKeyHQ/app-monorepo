import BigNumber from 'bignumber.js';

import {
  fitRangeDeposit,
  getAmountsForLiquidity,
  getLiquidityForAmounts,
  getRangeAmountsPerLiquidity,
  getRangeDepositShape,
  quoteRangeDeposit,
  toRawAmount,
} from './liquidityMath';
import { priceToSqrtRatioX96, tickToPrice } from './priceMath';
import { getSqrtRatioAtTick } from './tickMath';
import {
  getShareMint,
  getSharePositionAmounts,
  quoteShareDeposit,
} from './v2Math';

const decimals = { decimals0: 18, decimals1: 6 };
const sqrtRatioX96 = priceToSqrtRatioX96({ price: '400', ...decimals });
// Price 400 with 18/6 decimals sits at tick -216,407; this is about 360 to 440
const range = { tickLower: -217_440, tickUpper: -215_460 };

describe('LiquidityAmounts port', () => {
  it('never asks for more than the amounts given', () => {
    const amount0 = BigInt('2000000000000000000');
    const amount1 = BigInt('500000000');
    const sqrtA = getSqrtRatioAtTick(range.tickLower);
    const sqrtB = getSqrtRatioAtTick(range.tickUpper);
    const liquidity = getLiquidityForAmounts({
      sqrtRatioX96,
      sqrtRatioAX96: sqrtA,
      sqrtRatioBX96: sqrtB,
      amount0,
      amount1,
    });
    const used = getAmountsForLiquidity({
      sqrtRatioX96,
      sqrtRatioAX96: sqrtA,
      sqrtRatioBX96: sqrtB,
      liquidity,
    });
    expect(used.amount0 <= amount0).toBe(true);
    expect(used.amount1 <= amount1).toBe(true);
  });
});

describe('range deposits', () => {
  it('matches the doc §3.4 ratio inside the range', () => {
    const per = getRangeAmountsPerLiquidity({
      sqrtRatioX96,
      ...range,
      ...decimals,
    });
    const price = new BigNumber(400);
    const lower = tickToPrice({ tick: range.tickLower, ...decimals });
    const upper = tickToPrice({ tick: range.tickUpper, ...decimals });
    // a0 = 1/√P − 1/√Pb, a1 = √P − √Pa
    const a0 = new BigNumber(1)
      .div(price.sqrt())
      .minus(new BigNumber(1).div(upper.sqrt()));
    const a1 = price.sqrt().minus(lower.sqrt());
    const ratio = per.amount0.div(per.amount1).toNumber();
    expect(ratio / a0.div(a1).toNumber()).toBeCloseTo(1, 9);
  });

  it('derives the other side from one typed side', () => {
    const quote = quoteRangeDeposit({
      sqrtRatioX96,
      ...range,
      ...decimals,
      side: 1,
      amount: '1000',
    });
    expect(quote.liquidity > BigInt(0)).toBe(true);
    expect(quote.amount1.toNumber()).toBeCloseTo(1000, 4);
    const back = quoteRangeDeposit({
      sqrtRatioX96,
      ...range,
      ...decimals,
      side: 0,
      amount: quote.amount0,
    });
    expect(back.amount1.toNumber()).toBeCloseTo(1000, 3);
  });

  it('takes one token when the range is outside the price', () => {
    const above = { tickLower: -210_000, tickUpper: -200_000 };
    expect(getRangeDepositShape({ sqrtRatioX96, ...above })).toBe('token0Only');
    const quote = quoteRangeDeposit({
      sqrtRatioX96,
      ...above,
      ...decimals,
      side: 1,
      amount: '1000',
    });
    // token1 is not taken while the price sits below the range
    expect(quote.liquidity).toBe(BigInt(0));
    const below = { tickLower: -230_000, tickUpper: -220_000 };
    expect(getRangeDepositShape({ sqrtRatioX96, ...below })).toBe('token1Only');
  });

  it('keeps the unbalanced remainder in the wallet', () => {
    const fit = fitRangeDeposit({
      sqrtRatioX96,
      ...range,
      ...decimals,
      amount0: '3',
      amount1: '1000',
    });
    expect(fit.used0.plus(fit.leftover0).toNumber()).toBeCloseTo(3, 12);
    expect(fit.used1.plus(fit.leftover1).toNumber()).toBeCloseTo(1000, 5);
    // One side binds; the other has the leftover
    const bound = fit.leftover0.lt('0.000001') || fit.leftover1.lt('0.001');
    expect(bound).toBe(true);
  });

  it('floors raw amounts and treats junk as zero', () => {
    expect(toRawAmount('1.9999999', 6)).toBe(BigInt(1_999_999));
    expect(toRawAmount('', 6)).toBe(BigInt(0));
    expect(toRawAmount('-1', 6)).toBe(BigInt(0));
  });
});

describe('share pools (doc §3.4)', () => {
  const reserves = { reserve0: '100', reserve1: '340000' };

  it('quotes the other side at the reserve ratio', () => {
    const quote = quoteShareDeposit({ ...reserves, side: 0, amount: '1' });
    expect(quote.amount1.toNumber()).toBe(3400);
  });

  it('mints min(a0/r0, a1/r1) × supply and reports the share', () => {
    const mint = getShareMint({
      ...reserves,
      totalSupply: '1000',
      amount0: '1',
      amount1: '4000',
    });
    expect(mint.liquidity.toNumber()).toBe(10);
    expect(mint.used1.toNumber()).toBe(3400);
    expect(mint.leftover1.toNumber()).toBe(600);
    expect(mint.shareOfPool.toNumber()).toBeCloseTo(10 / 1010, 12);
  });

  it('values a position by its share of the reserves', () => {
    const amounts = getSharePositionAmounts({
      ...reserves,
      totalSupply: '1000',
      lpBalance: '50',
    });
    expect(amounts.amount0.toNumber()).toBe(5);
    expect(amounts.amount1.toNumber()).toBe(17_000);
  });
});
