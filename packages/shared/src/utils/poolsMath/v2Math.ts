import { PoolsBigNumber } from './priceMath';

import type BigNumber from 'bignumber.js';

// Share pools (V2_LIKE), doc §3.4: one LP token supply over two reserves.

export type IShareReserves = {
  reserve0: BigNumber.Value;
  reserve1: BigNumber.Value;
};

/** The other side at the pool ratio: amount1 = amount0 × reserve1 ÷ reserve0 */
export function quoteShareDeposit({
  reserve0,
  reserve1,
  side,
  amount,
}: IShareReserves & { side: 0 | 1; amount: BigNumber.Value }) {
  const value = new PoolsBigNumber(amount);
  const r0 = new PoolsBigNumber(reserve0);
  const r1 = new PoolsBigNumber(reserve1);
  if (!value.isFinite() || value.lte(0) || r0.lte(0) || r1.lte(0)) {
    return { amount0: new PoolsBigNumber(0), amount1: new PoolsBigNumber(0) };
  }
  if (side === 0) {
    return { amount0: value, amount1: value.times(r1).div(r0) };
  }
  return { amount0: value.times(r0).div(r1), amount1: value };
}

/**
 * LP tokens minted: min(amount0 ÷ reserve0, amount1 ÷ reserve1) × supply.
 * The unbalanced remainder stays in the wallet.
 */
export function getShareMint({
  reserve0,
  reserve1,
  totalSupply,
  amount0,
  amount1,
}: IShareReserves & {
  totalSupply: BigNumber.Value;
  amount0: BigNumber.Value;
  amount1: BigNumber.Value;
}) {
  const r0 = new PoolsBigNumber(reserve0);
  const r1 = new PoolsBigNumber(reserve1);
  const supply = new PoolsBigNumber(totalSupply);
  const a0 = new PoolsBigNumber(amount0);
  const a1 = new PoolsBigNumber(amount1);
  const ratio = PoolsBigNumber.max(
    PoolsBigNumber.min(a0.div(r0), a1.div(r1)),
    0,
  );
  const liquidity = ratio.times(supply);
  const used0 = ratio.times(r0);
  const used1 = ratio.times(r1);
  return {
    liquidity,
    used0,
    used1,
    leftover0: a0.minus(used0),
    leftover1: a1.minus(used1),
    shareOfPool: liquidity.div(supply.plus(liquidity)),
  };
}

export function getSharePositionAmounts({
  reserve0,
  reserve1,
  totalSupply,
  lpBalance,
}: IShareReserves & {
  totalSupply: BigNumber.Value;
  lpBalance: BigNumber.Value;
}) {
  const supply = new PoolsBigNumber(totalSupply);
  const share = supply.gt(0)
    ? new PoolsBigNumber(lpBalance).div(supply)
    : new PoolsBigNumber(0);
  return {
    amount0: share.times(reserve0),
    amount1: share.times(reserve1),
    shareOfPool: share,
  };
}
