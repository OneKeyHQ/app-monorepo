import BigNumber from 'bignumber.js';

import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { formatWithPrecision } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IBookLevel } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { type ITickParam } from './tickSizeUtils';
import { ceilToTickFast, floorToTickFast } from './utils';

import type {
  IAggregatedBookResult,
  IFormattedOBLevel,
  IOBLevel,
} from './types';

const formatOrderBookValue = (value: string): string => {
  if (!value) {
    return '0';
  }
  const formatted = numberFormat(value, { formatter: 'marketCap' });
  return (formatted as string) || '0';
};

const withDisplayFields = (levels: IOBLevel[]): IFormattedOBLevel[] =>
  levels.map((level) => ({
    ...level,
    displaySize: formatOrderBookValue(level.size),
    displayCumSize: formatOrderBookValue(level.cumSize),
  }));

// Aggregates in 1 iteration using BigNumber for precision
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

  let cumSizeBN = new BigNumber(0);
  let maxSizeBN = new BigNumber(0);
  let currLevel: IOBLevel = {
    price: '0',
    size: '0',
    cumSize: '0',
  };
  const aggregatedLevels: IOBLevel[] = [currLevel];

  // Pre-compute BigNumber tick factors for fast path rounding
  const tickSizeBN = new BigNumber(tickSize);
  const invTickSizeBN = new BigNumber(1).dividedBy(tickSizeBN);

  for (let i = 0; i < levels.length; i += 1) {
    const level = levels[i];
    const levelSizeBN = new BigNumber(level.size);
    cumSizeBN = cumSizeBN.plus(levelSizeBN);
    // Fast path: avoid validation and duplicate toFixed
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
      const currLevelSizeBN = new BigNumber(currLevel.size).plus(levelSizeBN);
      currLevel.size = formatWithPrecision(currLevelSizeBN, sizeDecimals);
      currLevel.cumSize = formatWithPrecision(cumSizeBN, sizeDecimals);
    } else {
      // Create and push new level.
      currLevel = {
        price: roundedPrice,
        size: level.size,
        cumSize: formatWithPrecision(cumSizeBN, sizeDecimals),
      };
      aggregatedLevels.push(currLevel);
    }

    // Update largest level size using BigNumber comparison.
    if (maxSizeBN.isLessThan(levelSizeBN)) {
      maxSizeBN = levelSizeBN;
    }

    // Exit if reached max levels.
    if (maxLevelsPerSide === aggregatedLevels.length) {
      break;
    }
  }

  return {
    aggregatedLevels,
    maxSize: formatWithPrecision(maxSizeBN, sizeDecimals),
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
  return prefixMaxSizes[idx] ?? formatWithPrecision(0, sizeDecimals);
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

// Convert HL.IBookLevel to IOBLevel format using BigNumber for precision
function convertHLBookLevelsToIOBLevels(
  levels: IBookLevel[],
  priceDecimals: number,
  sizeDecimals: number,
): { levels: IOBLevel[]; prefixMaxSizes: string[] } {
  let cumSizeBN = new BigNumber(0);
  let runningMaxSizeBN = new BigNumber(0);
  const prefixMaxSizes: string[] = [];
  const converted: IOBLevel[] = levels.map((level) => {
    const priceBN = new BigNumber(level.px);
    const sizeBN = new BigNumber(level.sz);
    cumSizeBN = cumSizeBN.plus(sizeBN);
    runningMaxSizeBN = BigNumber.maximum(sizeBN, runningMaxSizeBN);
    prefixMaxSizes.push(runningMaxSizeBN.toFixed(sizeDecimals));
    return {
      price: formatWithPrecision(priceBN, priceDecimals),
      size: formatWithPrecision(sizeBN, sizeDecimals),
      cumSize: formatWithPrecision(cumSizeBN, sizeDecimals),
    };
  });
  return { levels: converted, prefixMaxSizes };
}

export function useAggregatedBook(
  bids: IBookLevel[],
  asks: IBookLevel[],
  maxLevelsPerSide: number,
  activeTickOption: ITickParam | undefined,
  priceDecimals: number,
  sizeDecimals: number,
): IAggregatedBookResult {
  // Convert HL.IBookLevel to IOBLevel format with dynamic decimal places
  const { levels: convertedBids, prefixMaxSizes: bidsPrefixMaxSizes } =
    convertHLBookLevelsToIOBLevels(bids, priceDecimals, sizeDecimals);
  const { levels: convertedAsks, prefixMaxSizes: asksPrefixMaxSizes } =
    convertHLBookLevelsToIOBLevels(asks, priceDecimals, sizeDecimals);

  if (!activeTickOption) {
    return {
      bids: withDisplayFields(convertedBids),
      asks: withDisplayFields(convertedAsks),
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
      bids: withDisplayFields(rawBids),
      asks: withDisplayFields(rawAsks),
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
    bids: withDisplayFields(aggregatedBids),
    asks: withDisplayFields(aggregatedAsks),
    maxBidSize,
    maxAskSize,
  };
}
