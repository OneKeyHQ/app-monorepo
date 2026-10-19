import BigNumber from 'bignumber.js';

import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  isPoolPriceInverted,
  sqrtRatioX96ToPrice,
  tickToPrice,
  toDisplayPrice,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from './poolsCopy';

/** Base and quote as shown: prices read "quote per base" (doc §3.3) */
export function getPoolPair(pool: IPool) {
  const inverted = isPoolPriceInverted(pool);
  return {
    inverted,
    base: inverted ? pool.token1 : pool.token0,
    quote: inverted ? pool.token0 : pool.token1,
  };
}

export function getPoolPairTitle(pool: IPool) {
  const { base, quote } = getPoolPair(pool);
  return `${base.symbol} / ${quote.symbol}`;
}

/** Hundredths of a bip to percent: 3000 → 0.3% */
export function formatFeeTier(feeTier: number) {
  return `${new BigNumber(feeTier).div(10_000).toFixed()}%`;
}

export function getPoolVersionLabel(pool: Pick<IPool, 'version'>) {
  return pool.version.toUpperCase();
}

export function getPoolProtocolLabel(pool: Pick<IPool, 'version'>) {
  return `Uniswap ${getPoolVersionLabel(pool)}`;
}

export function isStockPool(pool: IPool) {
  return pool.token0.category === 'stock' || pool.token1.category === 'stock';
}

export function formatPercent(
  fraction: BigNumber.Value | undefined,
  decimals = 2,
) {
  const value = new BigNumber(fraction ?? Number.NaN);
  if (!value.isFinite()) {
    return '–';
  }
  return `${value.times(100).toFixed(decimals)}%`;
}

export function formatUsd(value: BigNumber.Value | undefined) {
  return numberFormat(new BigNumber(value ?? 0).toFixed(), {
    formatter: 'value',
    formatterOptions: { currency: '$' },
  });
}

export function formatCompactUsd(value: BigNumber.Value | undefined) {
  return numberFormat(new BigNumber(value ?? 0).toFixed(), {
    formatter: 'marketCap',
    formatterOptions: { currency: '$' },
  });
}

export function formatTokenAmount(
  value: BigNumber.Value | undefined,
  symbol?: string,
) {
  return numberFormat(new BigNumber(value ?? 0).toFixed(), {
    formatter: 'balance',
    formatterOptions: symbol ? { tokenSymbol: symbol } : undefined,
  });
}

export function formatTokenPrice(value: BigNumber.Value) {
  return numberFormat(new BigNumber(value).toFixed(), { formatter: 'price' });
}

/** Pool price in pool order: token1 per token0 */
export function getPoolPrice(pool: IPool) {
  if (pool.sqrtPriceX96) {
    return sqrtRatioX96ToPrice({
      sqrtRatioX96: BigInt(pool.sqrtPriceX96),
      decimals0: pool.token0.decimals,
      decimals1: pool.token1.decimals,
    });
  }
  return new BigNumber(pool.reserve1).div(pool.reserve0);
}

/** Price as shown: quote per base, or flipped when the user flips it */
export function getPoolDisplayPrice(pool: IPool, flipped = false) {
  const { inverted } = getPoolPair(pool);
  return toDisplayPrice(getPoolPrice(pool), flipped ? !inverted : inverted);
}

/** A tick's price as shown, in the pair's display direction */
export function getTickDisplayPrice(pool: IPool, tick: number) {
  const { inverted } = getPoolPair(pool);
  return toDisplayPrice(
    tickToPrice({
      tick,
      decimals0: pool.token0.decimals,
      decimals1: pool.token1.decimals,
    }),
    inverted,
  );
}

export function getPriceUnitLabel(pool: IPool) {
  const { base, quote } = getPoolPair(pool);
  return POOLS_COPY.priceIn(quote.symbol, base.symbol);
}
