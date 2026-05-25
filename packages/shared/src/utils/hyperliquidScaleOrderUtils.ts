import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  formatHlPrice,
  formatHlSize,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IFill } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IScaleOrderBuildParams,
  IScaleOrderChild,
  IScaleOrderGroup,
  IScaleOrderLeg,
  IScaleOrderStatus,
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

export function resolveScaleOrderGroupStatus(
  children: IScaleOrderChild[],
): IScaleOrderStatus {
  if (children.length === 0) {
    return 'failed';
  }
  const failedCount = children.filter(
    (child) => child.status === 'error',
  ).length;
  const filledCount = children.filter(
    (child) => child.status === 'filled',
  ).length;
  const canceledCount = children.filter(
    (child) => child.status === 'canceled',
  ).length;
  const hasFilledSize = children.some((child) =>
    new BigNumber(child.filledSize ?? 0).gt(0),
  );
  const activeCount = children.filter(
    (child) =>
      child.status === 'resting' ||
      child.status === 'placing' ||
      child.status === 'partiallyFilled',
  ).length;

  if (filledCount === children.length) return 'filled';
  if (canceledCount === children.length) {
    return hasFilledSize ? 'partiallyFilled' : 'canceled';
  }
  if (failedCount === children.length) return 'failed';
  if (failedCount > 0) return 'partiallyFailed';
  if (filledCount > 0 || hasFilledSize) return 'partiallyFilled';
  if (activeCount > 0) return 'active';
  return 'active';
}

export function getScaleOrderGroupFilledSize(group: IScaleOrderGroup): string {
  const filled = group.children.reduce((sum, child) => {
    const filledSize = new BigNumber(child.filledSize ?? 0);
    if (filledSize.gt(0)) {
      return sum.plus(filledSize);
    }
    if (child.status === 'filled') {
      return sum.plus(child.size);
    }
    return sum;
  }, new BigNumber(0));
  return filled.toFixed();
}

export function getScaleOrderChildFilledSize(
  child: IScaleOrderChild,
): BigNumber {
  const filledSize = new BigNumber(child.filledSize ?? 0);
  if (filledSize.gt(0)) {
    return filledSize;
  }
  if (child.status === 'filled') {
    return new BigNumber(child.size);
  }
  return new BigNumber(0);
}

export function buildScaleOrderFillInfoByOid(fills: IFill[]): Map<
  number,
  {
    filledSize: string;
    avgPx: string;
  }
> {
  const aggregates = new Map<
    number,
    {
      size: BigNumber;
      value: BigNumber;
    }
  >();

  fills.forEach((fill) => {
    if (typeof fill.oid !== 'number') {
      return;
    }
    const size = new BigNumber(fill.sz ?? 0);
    const price = new BigNumber(fill.px ?? 0);
    if (!size.isFinite() || size.lte(0) || !price.isFinite() || price.lte(0)) {
      return;
    }
    const current = aggregates.get(fill.oid) ?? {
      size: new BigNumber(0),
      value: new BigNumber(0),
    };
    aggregates.set(fill.oid, {
      size: current.size.plus(size),
      value: current.value.plus(size.multipliedBy(price)),
    });
  });

  const result = new Map<
    number,
    {
      filledSize: string;
      avgPx: string;
    }
  >();
  aggregates.forEach((aggregate, oid) => {
    result.set(oid, {
      filledSize: aggregate.size.toFixed(),
      avgPx: aggregate.value.dividedBy(aggregate.size).toFixed(),
    });
  });
  return result;
}

export function applyScaleOrderFillsToGroup({
  group,
  fills,
}: {
  group: IScaleOrderGroup;
  fills: IFill[];
}): { group: IScaleOrderGroup; changed: boolean } {
  const fillInfoByOid = buildScaleOrderFillInfoByOid(fills);
  if (fillInfoByOid.size === 0) {
    return { group, changed: false };
  }

  let changed = false;
  const children = group.children.map((child): IScaleOrderChild => {
    if (!child.oid) {
      return child;
    }
    const fillInfo = fillInfoByOid.get(child.oid);
    if (!fillInfo) {
      return child;
    }

    const filledSize = new BigNumber(fillInfo.filledSize);
    const childSize = new BigNumber(child.size);
    let nextStatus = child.status;
    if (childSize.gt(0) && filledSize.gte(childSize)) {
      nextStatus = 'filled';
    } else if (child.status === 'resting' || child.status === 'placing') {
      nextStatus = 'partiallyFilled';
    }
    if (
      child.filledSize === fillInfo.filledSize &&
      child.avgPx === fillInfo.avgPx &&
      child.status === nextStatus
    ) {
      return child;
    }

    changed = true;
    return {
      ...child,
      status: nextStatus,
      filledSize: fillInfo.filledSize,
      avgPx: fillInfo.avgPx,
    };
  });

  if (!changed) {
    return { group, changed: false };
  }

  const nextGroup: IScaleOrderGroup = {
    ...group,
    children,
    status: resolveScaleOrderGroupStatus(children),
    updatedAt: Date.now(),
  };
  return { group: nextGroup, changed: true };
}
