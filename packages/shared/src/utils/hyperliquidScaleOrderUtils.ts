import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  formatHlPrice,
  formatHlSize,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IScaleOrderBuildParams,
  IScaleOrderLeg,
  IScaleOrderValidationResult,
} from '@onekeyhq/shared/types/hyperliquid/types';

export const SCALE_ORDER_MIN_COUNT = 2;
export const SCALE_ORDER_MAX_COUNT = 100;
export const SCALE_ORDER_MIN_NOTIONAL = '10';

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
}): string[] {
  const { totalSize, orderCount, szDecimals } = params;
  const baseSize = totalSize
    .dividedBy(orderCount)
    .decimalPlaces(szDecimals, BigNumber.ROUND_FLOOR);
  const sizes: string[] = [];
  for (let index = 0; index < orderCount; index += 1) {
    const size =
      index === orderCount - 1
        ? totalSize.minus(baseSize.multipliedBy(orderCount - 1))
        : baseSize;
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
  });

  return Array.from({ length: normalizedCount }, (_, index) => {
    const rawPrice =
      side === 'long'
        ? maxPrice.minus(step.multipliedBy(index))
        : minPrice.plus(step.multipliedBy(index));
    return {
      index,
      price: formatHlPrice(rawPrice, szDecimals),
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
