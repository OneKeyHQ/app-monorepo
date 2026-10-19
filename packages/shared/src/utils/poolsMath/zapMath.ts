import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { PoolsBigNumber } from './priceMath';

import type BigNumber from 'bignumber.js';

// Zap in and Zap out, doc §3.6 and §3.7.

/**
 * Split input X so both pool tokens arrive at the deposit ratio.
 * perLiquidity: each token amount one unit of liquidity needs (any shared
 * scale). rate: pool token received per X, 1 when X already is that token.
 * Each unit of liquidity costs c = perLiquidity ÷ rate of X per side.
 */
export function splitZapInput({
  amountIn,
  perLiquidity0,
  perLiquidity1,
  rate0,
  rate1,
}: {
  amountIn: BigNumber.Value;
  perLiquidity0: BigNumber.Value;
  perLiquidity1: BigNumber.Value;
  rate0: BigNumber.Value;
  rate1: BigNumber.Value;
}) {
  const amount = new PoolsBigNumber(amountIn);
  const need0 = new PoolsBigNumber(perLiquidity0);
  const need1 = new PoolsBigNumber(perLiquidity1);
  const costPerLiquidity = (need: BigNumber, rate: BigNumber.Value) => {
    if (need.lte(0)) {
      return new PoolsBigNumber(0);
    }
    const value = new PoolsBigNumber(rate);
    if (!value.isFinite() || value.lte(0)) {
      throw new OneKeyLocalError('No swap route for a pool token');
    }
    return need.div(value);
  };
  const cost0 = costPerLiquidity(need0, rate0);
  const cost1 = costPerLiquidity(need1, rate1);
  const total = cost0.plus(cost1);
  if (!amount.isFinite() || amount.lte(0) || total.lte(0)) {
    return {
      toToken0: new PoolsBigNumber(0),
      toToken1: new PoolsBigNumber(0),
    };
  }
  const toToken0 = amount.times(cost0).div(total);
  return { toToken0, toToken1: amount.minus(toToken0) };
}

/** Pool token amount received for an X amount routed to one side */
export type IZapQuoteFn = (params: {
  side: 0 | 1;
  amountIn: BigNumber;
}) => Promise<BigNumber>;

/**
 * Quote at the full amount, split, then quote the split amounts and split
 * once more, because swap rates move with size (doc §3.6 steps 2–4).
 * inputSide marks X as one of the pool tokens: that side is kept, not swapped.
 */
export async function planZapSplit({
  amountIn,
  perLiquidity0,
  perLiquidity1,
  inputSide,
  quote,
}: {
  amountIn: BigNumber.Value;
  perLiquidity0: BigNumber.Value;
  perLiquidity1: BigNumber.Value;
  inputSide?: 0 | 1;
  quote: IZapQuoteFn;
}) {
  const amount = new PoolsBigNumber(amountIn);
  const needs = [
    new PoolsBigNumber(perLiquidity0).gt(0),
    new PoolsBigNumber(perLiquidity1).gt(0),
  ];
  const rateFor = async (side: 0 | 1, sideAmount: BigNumber) => {
    if (side === inputSide || !needs[side] || sideAmount.lte(0)) {
      return new PoolsBigNumber(1);
    }
    const out = await quote({ side, amountIn: sideAmount });
    return out.div(sideAmount);
  };

  let [rate0, rate1] = await Promise.all([
    rateFor(0, amount),
    rateFor(1, amount),
  ]);
  let split = splitZapInput({
    amountIn: amount,
    perLiquidity0,
    perLiquidity1,
    rate0,
    rate1,
  });
  [rate0, rate1] = await Promise.all([
    rateFor(0, split.toToken0),
    rateFor(1, split.toToken1),
  ]);
  split = splitZapInput({
    amountIn: amount,
    perLiquidity0,
    perLiquidity1,
    rate0,
    rate1,
  });
  return {
    ...split,
    rate0,
    rate1,
    expected0: split.toToken0.times(rate0),
    expected1: split.toToken1.times(rate1),
  };
}

/** Y = R0 × k0 + R1 × k1, with k = 1 for an amount already in Y */
export function estimateZapOut(
  legs: Array<{ amount: BigNumber.Value; rate: BigNumber.Value }>,
) {
  return legs.reduce(
    (sum, leg) => sum.plus(new PoolsBigNumber(leg.amount).times(leg.rate)),
    new PoolsBigNumber(0),
  );
}

/**
 * Sum amounts of the same asset across positions, first-seen order, so each
 * asset is swapped once when several positions exit together.
 */
export function mergeAssetAmounts(
  items: Array<{ assetId: string; amount: BigNumber.Value }>,
) {
  const merged = new Map<string, BigNumber>();
  for (const item of items) {
    const amount = new PoolsBigNumber(item.amount);
    if (amount.isFinite() && amount.gt(0)) {
      merged.set(
        item.assetId,
        (merged.get(item.assetId) ?? new PoolsBigNumber(0)).plus(amount),
      );
    }
  }
  return Array.from(merged, ([assetId, amount]) => ({ assetId, amount }));
}
