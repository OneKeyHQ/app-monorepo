import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IBookLevel } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { type ITickParam } from './tickSizeUtils';
import { ceilToTickFast, floorToTickFast } from './utils';

import type {
  IAggregatedBookResult,
  IFormattedOBLevel,
  IOBLevel,
  IOrderBookVariant,
} from './types';

const MARKET_CAP_UNIT_SUFFIX = /(K|M|B|T)$/;

const formatOrderBookValue = (
  value: string,
  variant: IOrderBookVariant,
): string => {
  if (!value) {
    return '0';
  }
  if (variant === 'mobileVertical') {
    const valueBN = new BigNumber(value);
    if (valueBN.isNaN()) {
      return value;
    }
    if (valueBN.isZero()) {
      return '0';
    }
    if (valueBN.abs().lt(0.01)) {
      return value;
    }
  }
  const formatted = numberFormat(value, { formatter: 'marketCap' });
  if (
    typeof formatted === 'string' &&
    (variant === 'mobileVertical' || MARKET_CAP_UNIT_SUFFIX.test(formatted))
  ) {
    return formatted;
  }
  return value;
};

const withDisplayFields = (
  levels: IOBLevel[],
  variant: IOrderBookVariant,
): IFormattedOBLevel[] =>
  levels.map((level) => ({
    ...level,
    displaySize: formatOrderBookValue(level.size, variant),
    displayCumSize: formatOrderBookValue(level.cumSize, variant),
  }));

// Aggregates levels by tick size in one pass.
// Size/cumSize tracking uses native Number — display-only values with ≤8 significant
// digits, no precision loss. BigNumber is kept only for price tick rounding because
// native floor/ceil can silently misalign on IEEE 754 boundary values (e.g.
// 40.93 * 100 = 4092.9999... in float64), which BigNumber handles correctly.
export function aggregateLevels(
  levels: IOBLevel[],
  maxLevelsPerSide: number,
  tickSize: string | number,
  roundingMode: 'floor' | 'ceil',
  sizeDecimals: number,
  priceDecimals: number,
) {
  if (!levels.length) {
    return {
      aggregatedLevels: levels,
      maxSize: '0',
    };
  }

  let cumSize = 0;
  let maxSize = 0;
  let currLevel: IOBLevel = {
    price: '0',
    size: '0',
    cumSize: '0',
  };
  const aggregatedLevels: IOBLevel[] = [currLevel];

  const tickSizeBN = new BigNumber(tickSize);
  const invTickSizeBN = new BigNumber(1).dividedBy(tickSizeBN);

  for (let i = 0; i < levels.length; i += 1) {
    const level = levels[i];
    const levelSize = parseFloat(level.size);
    cumSize += levelSize;
    const roundedPrice =
      roundingMode === 'floor'
        ? floorToTickFast(
            new BigNumber(level.price),
            invTickSizeBN,
            priceDecimals,
          )
        : ceilToTickFast(
            new BigNumber(level.price),
            invTickSizeBN,
            priceDecimals,
          );

    if (currLevel.price === '0' || roundedPrice === currLevel.price) {
      // Add to current level.
      currLevel.price = roundedPrice;
      currLevel.size = (parseFloat(currLevel.size) + levelSize).toFixed(
        sizeDecimals,
      );
      currLevel.cumSize = cumSize.toFixed(sizeDecimals);
    } else {
      // Create and push new level.
      currLevel = {
        price: roundedPrice,
        size: level.size,
        cumSize: cumSize.toFixed(sizeDecimals),
      };
      aggregatedLevels.push(currLevel);
    }

    if (levelSize > maxSize) {
      maxSize = levelSize;
    }

    // Exit if reached max levels.
    if (maxLevelsPerSide === aggregatedLevels.length) {
      break;
    }
  }

  return {
    aggregatedLevels,
    maxSize: maxSize.toFixed(sizeDecimals),
  };
}

function getMaxSizeFromPrefix(
  prefixMaxSizes: string[],
  count: number,
  sizeDecimals: number,
) {
  const idx = Math.min(
    Math.max(count - 1, 0),
    Math.max(prefixMaxSizes.length - 1, 0),
  );
  return prefixMaxSizes[idx] ?? (0).toFixed(sizeDecimals);
}

function sumAndSlice(
  bids: IOBLevel[],
  asks: IOBLevel[],
  maxLevelsPerSide: number,
  sizeDecimals: number,
  bidsPrefixMaxSizes: string[],
  asksPrefixMaxSizes: string[],
) {
  const slicedBids = bids.slice(0, maxLevelsPerSide);
  const slicedAsks = asks.slice(0, maxLevelsPerSide);
  const maxBidSize = getMaxSizeFromPrefix(
    bidsPrefixMaxSizes,
    slicedBids.length,
    sizeDecimals,
  );
  const maxAskSize = getMaxSizeFromPrefix(
    asksPrefixMaxSizes,
    slicedAsks.length,
    sizeDecimals,
  );

  return {
    bids: slicedBids,
    asks: slicedAsks,
    maxBidSize,
    maxAskSize,
  };
}

// Convert HL.IBookLevel to IOBLevel format.
// Native Number is used instead of BigNumber throughout: HL price/size values are
// standard decimal strings well within float64 precision, and this is display-only
// formatting with no financial arithmetic. BigNumber would add 10-50x overhead
// with zero precision benefit here.
function convertHLBookLevelsToIOBLevels(
  levels: IBookLevel[],
  priceDecimals: number,
  sizeDecimals: number,
): { levels: IOBLevel[]; prefixMaxSizes: string[] } {
  let cumSize = 0;
  let runningMax = 0;
  const prefixMaxSizes: string[] = [];
  const converted: IOBLevel[] = levels.map((level) => {
    const size = parseFloat(level.sz);
    cumSize += size;
    if (size > runningMax) runningMax = size;
    prefixMaxSizes.push(runningMax.toFixed(sizeDecimals));
    return {
      price: parseFloat(level.px).toFixed(priceDecimals),
      size: size.toFixed(sizeDecimals),
      cumSize: cumSize.toFixed(sizeDecimals),
    };
  });
  return { levels: converted, prefixMaxSizes };
}

export function useAggregatedBook(
  variant: IOrderBookVariant,
  bids: IBookLevel[],
  asks: IBookLevel[],
  maxLevelsPerSide: number,
  activeTickOption: ITickParam | undefined,
  priceDecimals: number,
  sizeDecimals: number,
): IAggregatedBookResult {
  return useMemo(() => {
    // Convert HL.IBookLevel to IOBLevel format with dynamic decimal places
    const { levels: convertedBids, prefixMaxSizes: bidsPrefixMaxSizes } =
      convertHLBookLevelsToIOBLevels(bids, priceDecimals, sizeDecimals);
    const { levels: convertedAsks, prefixMaxSizes: asksPrefixMaxSizes } =
      convertHLBookLevelsToIOBLevels(asks, priceDecimals, sizeDecimals);

    if (!activeTickOption) {
      return {
        bids: withDisplayFields(convertedBids, variant),
        asks: withDisplayFields(convertedAsks, variant),
        maxBidSize: '0',
        maxAskSize: '0',
      };
    }

    // Check if aggregation is needed
    const needsAggregation =
      activeTickOption.exact === false ||
      activeTickOption.targetTick !== activeTickOption.apiTick;

    if (!needsAggregation) {
      const {
        bids: rawBids,
        asks: rawAsks,
        maxBidSize,
        maxAskSize,
      } = sumAndSlice(
        convertedBids,
        convertedAsks,
        maxLevelsPerSide,
        sizeDecimals,
        bidsPrefixMaxSizes,
        asksPrefixMaxSizes,
      );
      return {
        bids: withDisplayFields(rawBids, variant),
        asks: withDisplayFields(rawAsks, variant),
        maxBidSize,
        maxAskSize,
      };
    }

    const { aggregatedLevels: aggregatedBids, maxSize: maxBidSize } =
      aggregateLevels(
        convertedBids,
        maxLevelsPerSide,
        activeTickOption.apiTick,
        'floor',
        sizeDecimals,
        priceDecimals,
      );

    const { aggregatedLevels: aggregatedAsks, maxSize: maxAskSize } =
      aggregateLevels(
        convertedAsks,
        maxLevelsPerSide,
        activeTickOption.apiTick,
        'ceil',
        sizeDecimals,
        priceDecimals,
      );

    return {
      bids: withDisplayFields(aggregatedBids, variant),
      asks: withDisplayFields(aggregatedAsks, variant),
      maxBidSize,
      maxAskSize,
    };
  }, [
    activeTickOption,
    asks,
    bids,
    maxLevelsPerSide,
    priceDecimals,
    sizeDecimals,
    variant,
  ]);
}
