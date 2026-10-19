import { EPoolPositionStatus } from '@onekeyhq/shared/types/pools';
import type { IPoolOutOfRangeSide } from '@onekeyhq/shared/types/pools';

import { PoolsBigNumber } from './priceMath';

import type BigNumber from 'bignumber.js';

// Position state (doc §3.9). Out of range below the lower tick the position
// is all token0; at or above the upper tick it is all token1.

export function getRangePositionStatus({
  liquidity,
  tickLower,
  tickUpper,
  currentTick,
}: {
  liquidity: bigint;
  tickLower: number;
  tickUpper: number;
  currentTick: number;
}): { status: EPoolPositionStatus; outOfRangeSide?: IPoolOutOfRangeSide } {
  if (liquidity <= BigInt(0)) {
    return { status: EPoolPositionStatus.Closed };
  }
  if (currentTick < tickLower) {
    return { status: EPoolPositionStatus.OutOfRange, outOfRangeSide: 'below' };
  }
  if (currentTick >= tickUpper) {
    return { status: EPoolPositionStatus.OutOfRange, outOfRangeSide: 'above' };
  }
  return { status: EPoolPositionStatus.Active };
}

export function getSharePositionStatus(lpBalance: BigNumber.Value) {
  return new PoolsBigNumber(lpBalance).gt(0)
    ? EPoolPositionStatus.Active
    : EPoolPositionStatus.Closed;
}

export function getAmountsValueUsd({
  amount0,
  amount1,
  price0Usd,
  price1Usd,
}: {
  amount0: BigNumber.Value;
  amount1: BigNumber.Value;
  price0Usd: BigNumber.Value;
  price1Usd: BigNumber.Value;
}) {
  return new PoolsBigNumber(amount0)
    .times(price0Usd)
    .plus(new PoolsBigNumber(amount1).times(price1Usd));
}
