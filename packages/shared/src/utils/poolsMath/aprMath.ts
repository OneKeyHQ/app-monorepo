import { PoolsBigNumber } from './priceMath';

import type BigNumber from 'bignumber.js';

// Fee APR estimates, doc §3.2 and §3.5 (active-liquidity share method).

export type IPoolsAprEstimate =
  | {
      status: 'ok';
      /** Fraction: 0.36 = 36% */
      apr: BigNumber;
      /** Against the pool average; range pools only */
      multiple?: BigNumber;
      /** Estimated for a tiny deposit because no amount is entered yet */
      isSmallAmount: boolean;
    }
  // Data is complete but the last 24h earned nothing: APR 0%, multiple "—"
  | { status: 'noFees' }
  // The price is outside the range, so the position earns nothing right now
  | { status: 'outOfRange' }
  // Missing data, zero TVL or active liquidity, or an unadapted hook
  | { status: 'unavailable' };

const DAYS_PER_YEAR = 365;

/** Pool average fee APR: past 24h LP fees × 365 ÷ current TVL */
export function getPoolFeeApr({
  fees24hUsd,
  tvlUsd,
}: {
  fees24hUsd: BigNumber.Value;
  tvlUsd: BigNumber.Value;
}): BigNumber | undefined {
  const fees = new PoolsBigNumber(fees24hUsd);
  const tvl = new PoolsBigNumber(tvlUsd);
  if (!fees.isFinite() || fees.lt(0) || !tvl.isFinite() || tvl.lte(0)) {
    return undefined;
  }
  return fees.times(DAYS_PER_YEAR).div(tvl);
}

/**
 * Range pools: B = (TVL ÷ V) × L ÷ (L_active + L) and APR = pool APR × B.
 * Before an amount is entered, B = TVL × k ÷ L_active, where k is the
 * liquidity one dollar buys in this range (a deposit too small to dilute).
 * Liquidity values are raw and must share one scale.
 */
export function estimateRangeApr({
  fees24hUsd,
  tvlUsd,
  activeLiquidity,
  inRange,
  supported,
  deposit,
  reference,
}: {
  fees24hUsd: BigNumber.Value;
  tvlUsd: BigNumber.Value;
  activeLiquidity: bigint;
  inRange: boolean;
  supported: boolean;
  deposit?: { liquidity: bigint; valueUsd: BigNumber.Value };
  reference?: { liquidity: bigint; valueUsd: BigNumber.Value };
}): IPoolsAprEstimate {
  if (!supported) {
    return { status: 'unavailable' };
  }
  if (!inRange) {
    return { status: 'outOfRange' };
  }
  const poolApr = getPoolFeeApr({ fees24hUsd, tvlUsd });
  if (!poolApr || activeLiquidity <= BigInt(0)) {
    return { status: 'unavailable' };
  }
  if (poolApr.isZero()) {
    return { status: 'noFees' };
  }
  const tvl = new PoolsBigNumber(tvlUsd);
  const active = new PoolsBigNumber(activeLiquidity.toString());

  const depositValue = new PoolsBigNumber(deposit?.valueUsd ?? 0);
  if (deposit && deposit.liquidity > BigInt(0) && depositValue.gt(0)) {
    const liquidity = new PoolsBigNumber(deposit.liquidity.toString());
    const multiple = tvl
      .div(depositValue)
      .times(liquidity)
      .div(active.plus(liquidity));
    return {
      status: 'ok',
      apr: poolApr.times(multiple),
      multiple,
      isSmallAmount: false,
    };
  }

  const referenceValue = new PoolsBigNumber(reference?.valueUsd ?? 0);
  if (reference && reference.liquidity > BigInt(0) && referenceValue.gt(0)) {
    const liquidityPerUsd = new PoolsBigNumber(
      reference.liquidity.toString(),
    ).div(referenceValue);
    const multiple = tvl.times(liquidityPerUsd).div(active);
    return {
      status: 'ok',
      apr: poolApr.times(multiple),
      multiple,
      isSmallAmount: true,
    };
  }
  return { status: 'unavailable' };
}

/**
 * Share pools have no range multiple: the same fee budget is split with the
 * new deposit, pool APR × TVL ÷ (TVL + V). Small deposits get the pool APR.
 */
export function estimateShareApr({
  fees24hUsd,
  tvlUsd,
  depositUsd,
}: {
  fees24hUsd: BigNumber.Value;
  tvlUsd: BigNumber.Value;
  depositUsd?: BigNumber.Value;
}): IPoolsAprEstimate {
  const poolApr = getPoolFeeApr({ fees24hUsd, tvlUsd });
  if (!poolApr) {
    return { status: 'unavailable' };
  }
  if (poolApr.isZero()) {
    return { status: 'noFees' };
  }
  const deposit = new PoolsBigNumber(depositUsd ?? 0);
  if (!deposit.isFinite() || deposit.lte(0)) {
    return { status: 'ok', apr: poolApr, isSmallAmount: true };
  }
  const tvl = new PoolsBigNumber(tvlUsd);
  return {
    status: 'ok',
    apr: poolApr.times(tvl).div(tvl.plus(deposit)),
    isSmallAmount: false,
  };
}
