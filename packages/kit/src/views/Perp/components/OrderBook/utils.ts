export function round(value: number, decimals = 0) {
  return Number(`${Math.round(Number(`${value}e${decimals}`))}e-${decimals}`);
}

export function floor(value: number, decimals = 0) {
  return Number(`${Math.floor(Number(`${value}e${decimals}`))}e-${decimals}`);
}

export function ceil(value: number, decimals = 0) {
  return Number(`${Math.ceil(Number(`${value}e${decimals}`))}e-${decimals}`);
}

export function roundToTick(n: number, tickSize: number) {
  return round(n * (1 / tickSize)) / (1 / tickSize);
}

export function floorToTick(n: number, tickSize: number) {
  return floor(n * (1 / tickSize)) / (1 / tickSize);
}

export function ceilToTick(n: number, tickSize: number) {
  return ceil(n * (1 / tickSize)) / (1 / tickSize);
}

export function getMidPrice(bestBid: number, bestAsk: number) {
  if (!bestBid) {
    return bestAsk;
  }
  if (!bestAsk) {
    return bestBid;
  }

  return (bestBid + bestAsk) / 2;
}

type IStringNumericLiteral =
  | `${number}`
  | 'Infinity'
  | '-Infinity'
  | '+Infinity';

export const abbrevNumFmt = (value: number | bigint | IStringNumericLiteral) =>
  Intl.NumberFormat(undefined, {
    notation: 'compact',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);

export const priceFmt = (value: number | bigint | IStringNumericLiteral) =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const sizeFmt = (value: number | bigint | IStringNumericLiteral) =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
