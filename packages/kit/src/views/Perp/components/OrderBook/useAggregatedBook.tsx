import BigNumber from 'bignumber.js';

import type { IBookLevel } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { ceilToTick, floorToTick } from './utils';

import type { IOBLevel } from './types';

// Aggregates in 1 iteration using BigNumber for precision
export function aggregateLevels(
  levels: IOBLevel[],
  maxLevelsPerSide: number,
  tickSize: string | number,
  roundFn: (n: string | number, tickSize: string | number) => string,
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

  for (let i = 0; i < levels.length; i += 1) {
    const level = levels[i];
    const levelSizeBN = new BigNumber(level.size);
    cumSizeBN = cumSizeBN.plus(levelSizeBN);
    const roundedPrice = roundFn(level.price, tickSize);

    if (currLevel.price === '0' || roundedPrice === currLevel.price) {
      // Add to current level.
      currLevel.price = roundedPrice;
      const currLevelSizeBN = new BigNumber(currLevel.size).plus(levelSizeBN);
      currLevel.size = currLevelSizeBN.toFixed();
      currLevel.cumSize = cumSizeBN.toFixed();
    } else {
      // Create and push new level.
      currLevel = {
        price: roundedPrice,
        size: level.size,
        cumSize: cumSizeBN.toFixed(),
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
    maxSize: maxSizeBN.toFixed(),
  };
}

function getMaxSize(levels: IOBLevel[]) {
  return levels
    .reduce((maxBN, level) => {
      const levelSizeBN = new BigNumber(level.size);
      return BigNumber.maximum(levelSizeBN, maxBN);
    }, new BigNumber(0))
    .toFixed();
}

function sumAndSlice(
  bids: IOBLevel[],
  asks: IOBLevel[],
  maxLevelsPerSide: number,
) {
  const slicedBids = bids.slice(0, maxLevelsPerSide);
  const slicedAsks = asks.slice(0, maxLevelsPerSide);
  const maxBidSize = getMaxSize(slicedBids);
  const maxAskSize = getMaxSize(slicedAsks);

  return {
    bids: slicedBids,
    asks: slicedAsks,
    maxBidSize,
    maxAskSize,
  };
}

// Convert HL.IBookLevel to IOBLevel format using BigNumber for precision
function convertHLBookLevelsToIOBLevels(levels: IBookLevel[]): IOBLevel[] {
  let cumSizeBN = new BigNumber(0);
  return levels.map((level) => {
    const priceBN = new BigNumber(level.px);
    const sizeBN = new BigNumber(level.sz);
    cumSizeBN = cumSizeBN.plus(sizeBN);
    return {
      price: priceBN.toFixed(),
      size: sizeBN.toFixed(),
      cumSize: cumSizeBN.toFixed(),
    };
  });
}

export function useAggregatedBook(
  bids: IBookLevel[],
  asks: IBookLevel[],
  baseTickSize: number,
  tickSize: number,
  maxLevelsPerSide: number,
) {
  // Convert HL.IBookLevel to IOBLevel format
  const convertedBids = convertHLBookLevelsToIOBLevels(bids);
  const convertedAsks = convertHLBookLevelsToIOBLevels(asks);

  const baseTickSizeStr = String(baseTickSize);
  const tickSizeStr = String(tickSize);

  if (new BigNumber(baseTickSizeStr).isEqualTo(tickSizeStr)) {
    return sumAndSlice(convertedBids, convertedAsks, maxLevelsPerSide);
  }

  const { aggregatedLevels: aggregatedBids, maxSize: maxBidSize } =
    aggregateLevels(convertedBids, maxLevelsPerSide, tickSizeStr, floorToTick);

  const { aggregatedLevels: aggregatedAsks, maxSize: maxAskSize } =
    aggregateLevels(convertedAsks, maxLevelsPerSide, tickSizeStr, ceilToTick);

  return {
    bids: aggregatedBids,
    asks: aggregatedAsks,
    maxBidSize,
    maxAskSize,
  };
}
