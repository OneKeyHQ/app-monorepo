// Only keep the functions that are actually used
function floor(value: number, decimals = 0) {
  return Number(`${Math.floor(Number(`${value}e${decimals}`))}e-${decimals}`);
}

function ceil(value: number, decimals = 0) {
  return Number(`${Math.ceil(Number(`${value}e${decimals}`))}e-${decimals}`);
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
