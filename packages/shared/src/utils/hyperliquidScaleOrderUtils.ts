import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  formatHlPrice,
  formatHlSize,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IScaleOrderBuildParams,
  IScaleOrderLeg,
  IScaleOrderSizeDistribution,
  IScaleOrderValidationResult,
} from '@onekeyhq/shared/types/hyperliquid/types';

export const SCALE_ORDER_MIN_COUNT = 2;
export const SCALE_ORDER_MAX_COUNT = 100;
export const SCALE_ORDER_MIN_NOTIONAL = '10';
export const SCALE_ORDER_FIXED_SIZE_SKEW = 1;
export const SCALE_ORDER_INCREASING_SIZE_SKEW = 2;

export function getScaleOrderSizeSkew(
  distribution?: IScaleOrderSizeDistribution,
): number {
  return distribution === 'increasing'
    ? SCALE_ORDER_INCREASING_SIZE_SKEW
    : SCALE_ORDER_FIXED_SIZE_SKEW;
}

export function normalizeScaleOrderCount(orderCount: string | number): number {
  const parsed = Number(orderCount);
  if (!Number.isInteger(parsed)) {
    return 0;
  }
  return parsed;
}

export function getScaleOrderPriceBounds(params: {
  lowerPrice?: string;
  upperPrice?: string;
  startPrice?: string;
  endPrice?: string;
}): { lowerPrice: BigNumber; upperPrice: BigNumber } {
  const first = new BigNumber(params.lowerPrice ?? params.startPrice ?? 0);
  const second = new BigNumber(params.upperPrice ?? params.endPrice ?? 0);
  if (!first.isFinite() || !second.isFinite()) {
    return {
      lowerPrice: new BigNumber(0),
      upperPrice: new BigNumber(0),
    };
  }
  return {
    lowerPrice: BigNumber.min(first, second),
    upperPrice: BigNumber.max(first, second),
  };
}

export function getScaleOrderReferencePrice(params: {
  lowerPrice?: string;
  upperPrice?: string;
  startPrice?: string;
  endPrice?: string;
}): BigNumber {
  const { lowerPrice, upperPrice } = getScaleOrderPriceBounds(params);
  if (!lowerPrice.gt(0) || !upperPrice.gt(0)) {
    return new BigNumber(0);
  }
  return lowerPrice.plus(upperPrice).dividedBy(2);
}

function buildScaleOrderSizeParts(params: {
  totalSize: BigNumber;
  orderCount: number;
  szDecimals: number;
  sizeSkew?: number;
}): string[] {
  const { totalSize, orderCount, szDecimals } = params;
  const rawSizeSkew = new BigNumber(params.sizeSkew ?? 1);
  const sizeSkew =
    rawSizeSkew.isFinite() && rawSizeSkew.gte(1)
      ? rawSizeSkew
      : new BigNumber(1);
  const firstSize = totalSize
    .multipliedBy(2)
    .dividedBy(orderCount)
    .dividedBy(sizeSkew.plus(1));
  const sizeStep =
    orderCount > 1
      ? firstSize.multipliedBy(sizeSkew.minus(1)).dividedBy(orderCount - 1)
      : new BigNumber(0);
  const sizes: string[] = [];
  let allocatedSize = new BigNumber(0);
  for (let index = 0; index < orderCount; index += 1) {
    const roundedSize = firstSize
      .plus(sizeStep.multipliedBy(index))
      .decimalPlaces(szDecimals, BigNumber.ROUND_FLOOR);
    const size =
      index === orderCount - 1 ? totalSize.minus(allocatedSize) : roundedSize;
    allocatedSize = allocatedSize.plus(size);
    sizes.push(formatHlSize(size, szDecimals));
  }
  return sizes;
}

export function buildScaleOrderLegs({
  totalSize,
  lowerPrice,
  upperPrice,
  orderCount,
  szDecimals,
  side,
  sizeSkew,
  assetType = 'perp',
}: IScaleOrderBuildParams): IScaleOrderLeg[] {
  const normalizedCount = normalizeScaleOrderCount(orderCount);
  const totalSizeBN = new BigNumber(totalSize);
  const lower = new BigNumber(lowerPrice);
  const upper = new BigNumber(upperPrice);

  if (
    normalizedCount < SCALE_ORDER_MIN_COUNT ||
    normalizedCount > SCALE_ORDER_MAX_COUNT ||
    !totalSizeBN.isFinite() ||
    totalSizeBN.lte(0) ||
    !lower.isFinite() ||
    lower.lte(0) ||
    !upper.isFinite() ||
    upper.lte(0) ||
    lower.eq(upper)
  ) {
    return [];
  }

  const minPrice = BigNumber.min(lower, upper);
  const maxPrice = BigNumber.max(lower, upper);
  const step = maxPrice.minus(minPrice).dividedBy(normalizedCount - 1);
  const sizes = buildScaleOrderSizeParts({
    totalSize: totalSizeBN,
    orderCount: normalizedCount,
    szDecimals,
    sizeSkew,
  });

  return Array.from({ length: normalizedCount }, (_, index) => {
    const rawPrice =
      side === 'long'
        ? maxPrice.minus(step.multipliedBy(index))
        : minPrice.plus(step.multipliedBy(index));
    return {
      index,
      price: formatHlPrice(rawPrice, szDecimals, assetType),
      size: sizes[index] ?? '',
    };
  });
}

export function validateScaleOrderLegs({
  legs,
  minNotional = SCALE_ORDER_MIN_NOTIONAL,
}: {
  legs: IScaleOrderLeg[];
  minNotional?: string;
}): IScaleOrderValidationResult {
  if (legs.length === 0) {
    return { isValid: false, errors: ['Invalid scale order parameters'] };
  }

  const errors: string[] = [];
  const priceSet = new Set<string>();
  const minNotionalBN = new BigNumber(minNotional);

  legs.forEach((leg) => {
    const priceBN = new BigNumber(leg.price);
    const sizeBN = new BigNumber(leg.size);
    if (!priceBN.isFinite() || priceBN.lte(0)) {
      errors.push(`Leg ${leg.index + 1}: invalid price`);
    }
    if (!sizeBN.isFinite() || sizeBN.lte(0)) {
      errors.push(`Leg ${leg.index + 1}: size is too small`);
    }
    if (priceSet.has(leg.price)) {
      errors.push('Price range is too tight for this market precision');
    }
    priceSet.add(leg.price);
    if (
      priceBN.isFinite() &&
      sizeBN.isFinite() &&
      priceBN.multipliedBy(sizeBN).lt(minNotionalBN)
    ) {
      errors.push(
        `Leg ${leg.index + 1}: notional must be at least $${minNotional}`,
      );
    }
  });

  return {
    isValid: errors.length === 0,
    errors: [...new Set(errors)],
  };
}

export function assertValidScaleOrderLegs(params: {
  legs: IScaleOrderLeg[];
  minNotional?: string;
}) {
  const result = validateScaleOrderLegs(params);
  if (!result.isValid) {
    throw new OneKeyLocalError(result.errors[0] ?? 'Invalid scale order');
  }
}

export function getReduceOnlyPositionSnapshotError({
  reduceOnly,
  accountAddress,
  positionsAccountAddress,
  message = 'Reduce-only position data unavailable, please try again',
}: {
  reduceOnly?: boolean;
  accountAddress?: string | null;
  positionsAccountAddress?: string | null;
  message?: string;
}): string | undefined {
  if (!reduceOnly) {
    return undefined;
  }

  const normalizedAccountAddress = accountAddress?.toLowerCase();
  const normalizedPositionsAccountAddress =
    positionsAccountAddress?.toLowerCase();

  if (
    !normalizedAccountAddress ||
    normalizedPositionsAccountAddress !== normalizedAccountAddress
  ) {
    return message;
  }

  return undefined;
}

export function getReduceOnlyOrderGuardError({
  reduceOnly,
  side,
  size,
  positionSize,
  missingPositionMessage = 'Reduce-only order requires an opposite open position',
  exceedsPositionMessage = 'Reduce-only order size exceeds the current position',
}: {
  reduceOnly?: boolean;
  side: 'long' | 'short';
  size: BigNumber.Value;
  positionSize?: BigNumber.Value | null;
  missingPositionMessage?: string;
  exceedsPositionMessage?: string;
}): string | undefined {
  if (!reduceOnly) {
    return undefined;
  }

  const sizeBN = new BigNumber(size);
  const positionSizeBN = new BigNumber(positionSize ?? 0);
  const isReducing =
    side === 'long' ? positionSizeBN.lt(0) : positionSizeBN.gt(0);

  if (!positionSizeBN.isFinite() || !isReducing) {
    return missingPositionMessage;
  }

  if (sizeBN.isFinite() && sizeBN.gt(positionSizeBN.abs())) {
    return exceedsPositionMessage;
  }

  return undefined;
}
