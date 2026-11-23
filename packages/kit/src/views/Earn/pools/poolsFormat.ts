import BigNumber from 'bignumber.js';

import {
  numberFormat,
  numberFormatAsRaw,
} from '@onekeyhq/shared/src/utils/numberUtils';
import {
  getDisplayRange,
  isPoolPriceInverted,
  sqrtRatioX96ToPrice,
  tickToPrice,
  toDisplayPrice,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPoolTickRange } from '@onekeyhq/shared/src/utils/poolsMath';
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

/** Token lists in pool order, put the way the pair reads: base first */
export function sortByPair<T>(
  pool: IPool | undefined,
  items: T[],
  getTokenId: (item: T) => string,
) {
  if (!pool) {
    return items;
  }
  const { base } = getPoolPair(pool);
  return items.toSorted(
    (a, b) =>
      Number(getTokenId(b) === base.id) - Number(getTokenId(a) === base.id),
  );
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

/** Pool-level quantities, compact like TVL: 26.38K WETH */
export function formatCompactTokenAmount(
  value: BigNumber.Value | undefined,
  symbol?: string,
) {
  return numberFormat(new BigNumber(value ?? 0).toFixed(), {
    formatter: 'marketCap',
    formatterOptions: symbol ? { tokenSymbol: symbol } : undefined,
  });
}

/**
 * An amount in a one-line summary such as a swap: millions and up compact
 * (44.97M PEPE), smaller amounts exact as balances.
 */
export function formatTokenAmountShort(
  value: BigNumber.Value | undefined,
  symbol?: string,
) {
  return new BigNumber(value ?? 0).abs().gte(1_000_000)
    ? formatCompactTokenAmount(value, symbol)
    : formatTokenAmount(value, symbol);
}

/** A price against today's: +14.00%, -6.70% */
export function formatPriceChange(value: BigNumber, now: BigNumber) {
  const change = value.div(now).minus(1).times(100);
  if (!change.isFinite()) {
    return undefined;
  }
  return `${change.gt(0) ? '+' : ''}${change.toFixed(2)}%`;
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

/**
 * A price as plain text. Past four zeros after the point, the zeros become a
 * count, as Market and the charts show them: 0.0₈1683, not 0.000000001683.
 */
export function formatTokenPrice(value: BigNumber.Value) {
  const parts = numberFormatAsRaw(new BigNumber(value).toFixed(), {
    formatter: 'price',
  });
  if (typeof parts === 'string') {
    return parts;
  }
  return parts
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }
      if (part.type === 'sub') {
        return String(part.value).replace(/[0-9]/g, (digit) =>
          SUBSCRIPT_DIGITS.charAt(Number(digit)),
        );
      }
      return part.value;
    })
    .join('');
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
export type IPoolRisk = 'unknownToken' | 'lowActivity';

/**
 * Why adding to a pool asks for a risk confirm, if it does: a token with no
 * trusted price, or too little trading for the list to show the pool
 */
export function getPoolRisk(pool: IPool): IPoolRisk | undefined {
  if (pool.token0.hasUntrustedPrice || pool.token1.hasUntrustedPrice) {
    return 'unknownToken';
  }
  return pool.isOffList ? 'lowActivity' : undefined;
}

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

/** "USDC per WETH"; `flipped` when the chart shows prices the other way */
export function getPriceUnitLabel(pool: IPool, flipped = false) {
  const { base, quote } = getPoolPair(pool);
  return flipped
    ? POOLS_COPY.priceIn(base.symbol, quote.symbol)
    : POOLS_COPY.priceIn(quote.symbol, base.symbol);
}

/** A range on one line, "2,104.12 – 2,801.33", and the unit under it */
export function getRangeLine(
  pool: IPool,
  range: IPoolTickRange,
  flipped = false,
) {
  const { inverted } = getPoolPair(pool);
  const display = getDisplayRange({
    ...range,
    tickSpacing: pool.tickSpacing ?? 60,
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
    inverted: flipped ? !inverted : inverted,
  });
  if (display.isMinZero && display.isMaxInfinite) {
    return { text: POOLS_COPY.fullRange, unit: undefined };
  }
  const min = display.isMinZero ? '0' : formatTokenPrice(display.min);
  const max = display.isMaxInfinite ? '∞' : formatTokenPrice(display.max);
  return { text: `${min} – ${max}`, unit: getPriceUnitLabel(pool, flipped) };
}
