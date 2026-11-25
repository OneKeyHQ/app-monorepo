import { buildMonotoneCurveSegments } from '@onekeyhq/kit/src/components/LightweightChart/utils/monotoneCurve';

import { PERPS_DEPTH_BOOK_RADIUS as DEPTH_PRICE_RANGE_RATIO } from '../../utils/perpDepthBook';

import type { IOBLevel } from './types';

export type IPerpDepthLevel = Pick<IOBLevel, 'price' | 'cumSize'>;
export const DEPTH_MARKER_HIT_SLOP = 8;
export { DEPTH_PRICE_RANGE_RATIO };
const DEPTH_SHRINK_DELAY_MS = 1500;

type IPlottedLevel = IPerpDepthLevel & {
  plotPrice: number;
  x: number;
  y: number;
};
type IParsedLevel = IPerpDepthLevel & {
  numericPrice: number;
  numericSize: number;
};
type IDepthSide = {
  levels: IPlottedLevel[];
  stroke?: string;
  fill?: string;
};

type IDepthChartGeometry = {
  bids: IDepthSide;
  asks: IDepthSide;
  minPrice: number;
  maxPrice: number;
  midPrice?: number;
  maxSize: number;
  toX: (price: number) => number;
  toPrice: (x: number) => number;
};

type IDepthChartBook = {
  bids: ReadonlyArray<IPerpDepthLevel>;
  asks: ReadonlyArray<IPerpDepthLevel>;
  referenceMidPrice?: number;
};

export type IDepthChartDomain = {
  minPrice: number;
  maxPrice: number;
  maxSize: number;
  anchorMid?: number;
  priceRangeRatio?: number;
  isZoomed?: boolean;
  shrinkAt?: number;
};

export type IDepthChartSelection = {
  side: 'bid' | 'ask';
  level: IPlottedLevel;
  price: number;
};

function isPositiveFinite(value: number | undefined): value is number {
  return value !== undefined && value > 0 && Number.isFinite(value);
}

function parseLevels(
  levels: ReadonlyArray<IPerpDepthLevel>,
  direction: -1 | 1,
) {
  const validLevels = levels
    .map((level) => ({
      ...level,
      numericPrice: Number(level.price),
      numericSize: Number(level.cumSize),
    }))
    .filter(
      ({ numericPrice, numericSize }) =>
        Number.isFinite(numericPrice) &&
        numericPrice > 0 &&
        Number.isFinite(numericSize) &&
        numericSize > 0,
    );

  const parsed: IParsedLevel[] = [];
  for (const level of validLevels) {
    const { numericPrice, numericSize } = level;
    const previous = parsed.at(-1);
    const priceMove = previous
      ? (numericPrice - previous.numericPrice) * direction
      : 1;
    if (
      previous &&
      (priceMove < 0 ||
        numericSize < previous.numericSize ||
        (priceMove === 0 && numericSize !== previous.numericSize))
    ) {
      return [];
    }
    if (priceMove > 0) {
      parsed.push(level);
    }
  }
  return parsed;
}

function parseBook(
  bids: IDepthChartBook['bids'],
  asks: IDepthChartBook['asks'],
) {
  const bidLevels = parseLevels(bids, -1);
  const askLevels = parseLevels(asks, 1);
  const bestBid = bidLevels[0]?.numericPrice;
  const bestAsk = askLevels[0]?.numericPrice;
  const minPrice = bidLevels.at(-1)?.numericPrice ?? bestAsk;
  const maxPrice = askLevels.at(-1)?.numericPrice ?? bestBid;
  if (
    minPrice === undefined ||
    maxPrice === undefined ||
    (bestBid !== undefined && bestAsk !== undefined && bestBid >= bestAsk)
  ) {
    return undefined;
  }
  return { bidLevels, askLevels, minPrice, maxPrice };
}

function getDefaultPriceRange(
  book: NonNullable<ReturnType<typeof parseBook>>,
  center: number,
) {
  const bidRange = center - book.minPrice;
  const askRange = book.maxPrice - center;
  const sharedRange = Math.min(bidRange, askRange);
  const secondBid = book.bidLevels[1]?.numericPrice;
  const secondAsk = book.askLevels[1]?.numericPrice;
  // Fit both sides to the edges without extending beyond observed prices.
  // Sparse or one-sided books retain their full available coverage.
  const canFitBothSides =
    secondBid !== undefined &&
    secondAsk !== undefined &&
    sharedRange > 0 &&
    center - secondBid <= sharedRange &&
    secondAsk - center <= sharedRange;
  const observedRange =
    (canFitBothSides ? sharedRange : Math.max(bidRange, askRange)) / center;
  return isPositiveFinite(observedRange)
    ? Math.min(DEPTH_PRICE_RANGE_RATIO, observedRange)
    : DEPTH_PRICE_RANGE_RATIO;
}

function getWheelPriceRange(
  book: NonNullable<ReturnType<typeof parseBook>>,
  center: number,
  current: number,
  delta: number,
) {
  if (!Number.isFinite(delta) || delta === 0) return undefined;
  const defaultRange = getDefaultPriceRange(book, center);
  const zoomingOut = delta > 0;
  if (zoomingOut && current >= defaultRange) return undefined;

  const secondBid = book.bidLevels[1]?.numericPrice;
  const secondAsk = book.askLevels[1]?.numericPrice;
  const minRange =
    secondBid === undefined || secondAsk === undefined
      ? Infinity
      : Math.max((center - secondBid) / center, (secondAsk - center) / center);
  const maxRange = Math.min(
    defaultRange,
    (center - book.minPrice) / center,
    (book.maxPrice - center) / center,
  );
  const next = current * Math.exp(Math.max(-240, Math.min(240, delta)) / 400);

  // The default viewport can still be restored when the live book no longer
  // covers it. Plot geometry leaves the unobserved prices blank.
  if (zoomingOut) {
    return next >= maxRange || minRange > maxRange
      ? defaultRange
      : Math.max(next, minRange);
  }
  if (minRange > maxRange) return undefined;
  const closer = Math.max(minRange, Math.min(next, maxRange));
  return closer < current ? closer : undefined;
}

function clipSide(
  levels: IParsedLevel[],
  direction: -1 | 1,
  minPrice: number,
  maxPrice: number,
) {
  const first = levels[0];
  const last = levels.at(-1);
  if (!first || !last) {
    return [];
  }

  const lower = Math.max(
    minPrice,
    direction === -1 ? last.numericPrice : first.numericPrice,
  );
  const upper = Math.min(
    maxPrice,
    direction === -1 ? first.numericPrice : last.numericPrice,
  );
  if (lower > upper) {
    return [];
  }

  const visible = levels
    .filter(
      ({ numericPrice }) => numericPrice >= lower && numericPrice <= upper,
    )
    .map((level) => ({ ...level, plotPrice: level.numericPrice }));
  const inner = direction === -1 ? upper : lower;
  const outer = direction === -1 ? lower : upper;

  // Only clip inside measured book coverage and carry the step from the better
  // known price. The next, more expensive level does not contribute yet.
  if (visible[0]?.plotPrice !== inner) {
    const level = levels.findLast(
      ({ numericPrice }) => direction * (numericPrice - inner) <= 0,
    );
    if (level) visible.unshift({ ...level, plotPrice: inner });
  }
  if (visible.at(-1)?.plotPrice !== outer) {
    const level = levels.findLast(
      ({ numericPrice }) => direction * (numericPrice - outer) <= 0,
    );
    if (level) visible.push({ ...level, plotPrice: outer });
  }
  return visible;
}

function getDepthAxisCeiling(size: number) {
  const requiredStep = (size / 4) * 1.1;
  const magnitude = 10 ** Math.floor(Math.log10(requiredStep));
  // Keep readable ticks without rounding a 1K book all the way up to 2K.
  const multiplier =
    [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10].find(
      (step) => step >= requiredStep / magnitude,
    ) ?? 10;
  const niceMaximum = 4 * multiplier * magnitude;
  return isPositiveFinite(niceMaximum) ? Math.max(size, niceMaximum) : size;
}

export function updateDepthChartDomain({
  bids,
  asks,
  referenceMidPrice,
  previous,
  now,
  wheelDelta,
}: IDepthChartBook & {
  previous?: IDepthChartDomain;
  now: number;
  wheelDelta?: number;
}): IDepthChartDomain | undefined {
  const book = parseBook(bids, asks);
  if (!book) {
    return previous?.shrinkAt === undefined
      ? previous
      : { ...previous, shrinkAt: undefined };
  }

  let anchorMid = previous?.anchorMid;
  const center = isPositiveFinite(referenceMidPrice)
    ? referenceMidPrice
    : anchorMid;
  const defaultRange =
    center === undefined
      ? DEPTH_PRICE_RANGE_RATIO
      : getDefaultPriceRange(book, center);
  let priceRangeRatio = previous?.priceRangeRatio ?? defaultRange;
  let isZoomed = previous?.isZoomed ?? false;
  // Shrink immediately to avoid empty margins after coverage contracts. Keep
  // small expansions stable and preserve the user's manually chosen zoom.
  if (
    wheelDelta === undefined &&
    !isZoomed &&
    (anchorMid === undefined ||
      defaultRange > priceRangeRatio * 1.25 ||
      defaultRange < priceRangeRatio)
  ) {
    priceRangeRatio = defaultRange;
  }
  if (wheelDelta !== undefined) {
    if (center === undefined) return previous;
    const zoomed = getWheelPriceRange(
      book,
      center,
      priceRangeRatio,
      wheelDelta,
    );
    if (zoomed === undefined) return previous;
    priceRangeRatio = zoomed;
    isZoomed = zoomed < defaultRange;
  }

  let { minPrice, maxPrice } =
    anchorMid === undefined ? book : (previous ?? book);
  // Keep the live midpoint centered while retaining the chosen zoom width.
  const nextAnchor = isPositiveFinite(referenceMidPrice)
    ? referenceMidPrice
    : anchorMid;
  if (nextAnchor !== undefined) {
    const halfWidth = nextAnchor * priceRangeRatio;
    const newMin = nextAnchor - halfWidth;
    const newMax = nextAnchor + halfWidth;
    if (
      isPositiveFinite(newMin) &&
      isPositiveFinite(newMax) &&
      newMax > newMin
    ) {
      anchorMid = nextAnchor;
      minPrice = newMin;
      maxPrice = newMax;
    }
  }

  const maxVisibleSize = Math.max(
    clipSide(book.bidLevels, -1, minPrice, maxPrice).at(-1)?.numericSize ?? 0,
    clipSide(book.askLevels, 1, minPrice, maxPrice).at(-1)?.numericSize ?? 0,
  );
  const desired =
    maxVisibleSize > 0
      ? getDepthAxisCeiling(maxVisibleSize)
      : (previous?.maxSize ?? 1);
  let maxSize = previous?.maxSize ?? desired;
  let shrinkAt = previous?.shrinkAt;
  if (desired > maxSize) {
    maxSize = desired;
    shrinkAt = undefined;
  } else if (desired >= maxSize || maxVisibleSize >= maxSize * 0.75) {
    shrinkAt = undefined;
  } else if (shrinkAt !== undefined && now >= shrinkAt) {
    maxSize = desired;
    shrinkAt = undefined;
  } else {
    shrinkAt ??= now + DEPTH_SHRINK_DELAY_MS;
  }

  if (
    previous &&
    previous.minPrice === minPrice &&
    previous.maxPrice === maxPrice &&
    previous.maxSize === maxSize &&
    previous.shrinkAt === shrinkAt &&
    previous.anchorMid === anchorMid &&
    previous.priceRangeRatio === priceRangeRatio &&
    previous.isZoomed === isZoomed
  ) {
    return previous;
  }
  return {
    minPrice,
    maxPrice,
    maxSize,
    anchorMid,
    priceRangeRatio,
    isZoomed,
    shrinkAt,
  };
}

function getSidePaths(
  levels: IPlottedLevel[],
  height: number,
  baselineX?: number,
): IDepthSide {
  const first = levels[0];
  const last = levels.at(-1);
  if (!first || !last || first === last) {
    return { levels };
  }

  // Mirror bids so the shared monotone interpolator always sees increasing x.
  // Only the display path is interpolated; hit testing retains real levels.
  const direction = last.x >= first.x ? 1 : -1;
  const segments = buildMonotoneCurveSegments(
    levels.map(({ x, y }) => ({ x: x * direction, y })),
  );
  const coordinate = (value: number) => Number(value.toFixed(3));
  const start =
    baselineX === undefined
      ? `M ${first.x} ${first.y}`
      : `M ${baselineX} ${height} H ${first.x} V ${first.y}`;
  const stroke = `${start}${segments
    .map(
      ({ cp1x, cp1y, cp2x, cp2y, x, y }) =>
        ` C ${coordinate(cp1x * direction)} ${coordinate(cp1y)} ${coordinate(cp2x * direction)} ${coordinate(cp2y)} ${coordinate(x * direction)} ${coordinate(y)}`,
    )
    .join('')}`;

  return {
    levels,
    stroke,
    fill: `${stroke} V ${height} H ${baselineX ?? first.x} Z`,
  };
}

export function buildDepthChartGeometry({
  bids,
  asks,
  width,
  height,
  domain,
  referenceMidPrice,
}: IDepthChartBook & {
  width: number;
  height: number;
  domain?: IDepthChartDomain;
}): IDepthChartGeometry | undefined {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return undefined;
  }

  const book = parseBook(bids, asks);
  if (!book) {
    return undefined;
  }

  const { minPrice, maxPrice } = domain ?? book;
  const bidLevels = clipSide(book.bidLevels, -1, minPrice, maxPrice);
  const askLevels = clipSide(book.askLevels, 1, minPrice, maxPrice);
  const maxSize = Math.max(
    domain?.maxSize ?? 0,
    bidLevels.at(-1)?.numericSize ?? 0,
    askLevels.at(-1)?.numericSize ?? 0,
  );
  const span = maxPrice - minPrice;
  const toX = (price: number) =>
    span > 0
      ? Number((((price - minPrice) / span) * width).toFixed(3))
      : width / 2;
  const toPrice = (x: number) => minPrice + (x / width) * span;
  const plotLevels = (levels: ReturnType<typeof clipSide>) =>
    levels.map(({ price, cumSize, plotPrice, numericSize }) => ({
      price,
      cumSize,
      plotPrice,
      x: toX(plotPrice),
      y: height - (numericSize / maxSize) * height,
    }));

  const bestBid = book.bidLevels[0]?.numericPrice;
  const bestAsk = book.askLevels[0]?.numericPrice;
  const midPrice =
    bestBid !== undefined &&
    bestAsk !== undefined &&
    isPositiveFinite(referenceMidPrice)
      ? referenceMidPrice
      : undefined;
  // There are no orders inside the spread. Join the curves at zero without
  // adding synthetic levels that could be selected as real liquidity.
  const baselineX =
    midPrice !== undefined &&
    bestBid !== undefined &&
    bestAsk !== undefined &&
    midPrice >= bestBid &&
    midPrice <= bestAsk &&
    midPrice >= minPrice &&
    midPrice <= maxPrice
      ? toX(midPrice)
      : undefined;

  return {
    bids: getSidePaths(plotLevels(bidLevels), height, baselineX),
    asks: getSidePaths(plotLevels(askLevels), height, baselineX),
    minPrice,
    maxPrice,
    midPrice,
    maxSize,
    toX,
    toPrice,
  };
}

function getLevelOnSide(
  { levels }: IDepthSide,
  position: number,
  direction: -1 | 1,
  coordinate: (level: IPlottedLevel) => number,
) {
  const inner = levels[0];
  const outer = levels.at(-1);
  if (
    !inner ||
    !outer ||
    direction * (position - coordinate(inner)) < 0 ||
    direction * (position - coordinate(outer)) > 0
  ) {
    return undefined;
  }
  return levels.findLast(
    (level) => direction * (coordinate(level) - position) <= 0,
  );
}

export function getDepthChartLevelAtPrice(
  geometry: IDepthChartGeometry | undefined,
  price: number,
): IDepthChartSelection | undefined {
  if (!geometry || !Number.isFinite(price)) {
    return undefined;
  }
  const bid = getLevelOnSide(
    geometry.bids,
    price,
    -1,
    (level) => level.plotPrice,
  );
  if (bid) {
    return { side: 'bid', level: bid, price };
  }
  const ask = getLevelOnSide(
    geometry.asks,
    price,
    1,
    (level) => level.plotPrice,
  );
  return ask ? { side: 'ask', level: ask, price } : undefined;
}

export function getDepthChartLevel(
  geometry: IDepthChartGeometry | undefined,
  x: number,
): IDepthChartSelection | undefined {
  if (!geometry || !Number.isFinite(x)) {
    return undefined;
  }

  const { bids, asks } = geometry;
  const bestBid = bids.levels[0];
  const bestAsk = asks.levels[0];
  const bid = getLevelOnSide(bids, x, -1, (level) => level.x);
  if (bid) {
    return {
      side: 'bid',
      level: bid,
      price: bid.x === x ? bid.plotPrice : geometry.toPrice(x),
    };
  }
  const ask = getLevelOnSide(asks, x, 1, (level) => level.x);
  if (ask) {
    return {
      side: 'ask',
      level: ask,
      price: ask.x === x ? ask.plotPrice : geometry.toPrice(x),
    };
  }

  const bidDistance =
    bestBid && bids.levels.length === 1 ? Math.abs(x - bestBid.x) : Infinity;
  const askDistance =
    bestAsk && asks.levels.length === 1 ? Math.abs(x - bestAsk.x) : Infinity;
  if (
    bestBid &&
    bidDistance < askDistance &&
    bidDistance <= DEPTH_MARKER_HIT_SLOP
  ) {
    return { side: 'bid', level: bestBid, price: bestBid.plotPrice };
  }
  if (
    bestAsk &&
    askDistance < bidDistance &&
    askDistance <= DEPTH_MARKER_HIT_SLOP
  ) {
    return { side: 'ask', level: bestAsk, price: bestAsk.plotPrice };
  }
  return undefined;
}

export function getDepthChartHoverSelections(
  geometry: IDepthChartGeometry,
  x: number,
): IDepthChartSelection[] {
  const price = geometry.toPrice(x);
  if (
    !Number.isFinite(price) ||
    price < geometry.minPrice ||
    price > geometry.maxPrice
  ) {
    return [];
  }
  const mid = geometry.midPrice;
  const distance = mid === undefined ? undefined : Math.abs(price - mid);
  const candidates =
    mid === undefined || distance === undefined
      ? [getDepthChartLevel(geometry, x)]
      : [
          getDepthChartLevelAtPrice(geometry, mid - distance),
          getDepthChartLevelAtPrice(geometry, mid + distance),
        ];
  // Compare equal price distances, then snap each marker to an actual level.
  // Never label interpolated curve values as real cumulative liquidity.
  return candidates.flatMap((selection) => {
    if (!selection) return [];
    const levelPrice = Number(selection.level.price);
    if (levelPrice < geometry.minPrice || levelPrice > geometry.maxPrice)
      return [];
    return [{ ...selection, price: levelPrice }];
  });
}
