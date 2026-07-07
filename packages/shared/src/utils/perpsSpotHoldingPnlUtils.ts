import BigNumber from 'bignumber.js';

export const SPOT_HOLDING_STABLE_COINS = new Set([
  'USDC',
  'USDT',
  'USDB',
  'USDH',
]);

export function isSpotHoldingStableCoin(coin: string) {
  return SPOT_HOLDING_STABLE_COINS.has(coin.toUpperCase());
}

export function calculateSpotHoldingPnl({
  total,
  entryNtl,
  priceUsd,
  isStable,
}: {
  total: string;
  entryNtl?: string;
  priceUsd?: string;
  isStable: boolean;
}): string | undefined {
  const totalBN = new BigNumber(total);
  const entryNtlBN = new BigNumber(entryNtl || '0');
  const priceUsdBN = new BigNumber(priceUsd || '0');

  if (
    isStable ||
    !priceUsd ||
    !totalBN.isFinite() ||
    !entryNtlBN.isFinite() ||
    !priceUsdBN.isFinite()
  ) {
    return undefined;
  }

  return totalBN.multipliedBy(priceUsdBN).minus(entryNtlBN).toFixed();
}
