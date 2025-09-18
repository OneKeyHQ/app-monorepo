/**
 * HyperLiquid OrderBook Tick Size Utilities
 *
 * Generates tick size options and maps them to HyperLiquid L2Book API parameters
 * based on price and decimal precision requirements.
 */

import BigNumber from 'bignumber.js';

import { OneKeyError } from '@onekeyhq/shared/src/errors';

type INSig = 2 | 3 | 4 | 5 | null;
type IMantissa = 2 | 5;

export interface ITickParam {
  targetTick: number; // decimals * multiplier
  nSigFigs: INSig;
  mantissa?: IMantissa; // only when nSigFigs=5
  apiTick: number; // actual step size for this combination
  exact: boolean; // whether targetTick exactly matches apiTick
  multiplier: number; // the multiplier used (1, 2, 5, 10, 100, 1000)
  label: string;
  value: string;
}

function floorLog10(x: number): number {
  return Math.floor(Math.log10(x));
}

/**
 * List all valid (nSigFigs, mantissa) combinations and their step sizes
 * for the given price magnitude
 */
function allowedPairs(price: number) {
  if (!(Number.isFinite(price) && price > 0)) {
    throw new OneKeyError('price must be > 0');
  }

  const e = floorLog10(price);

  return [
    { n: 2 as const, step: new BigNumber(10).pow(e - 1).toNumber() }, // 10^(e-1)
    { n: 3 as const, step: new BigNumber(10).pow(e - 2).toNumber() }, // 10^(e-2)
    { n: 4 as const, step: new BigNumber(10).pow(e - 3).toNumber() }, // 10^(e-3)
    {
      n: 5 as const,
      step: new BigNumber(1)
        .multipliedBy(new BigNumber(10).pow(e - 4))
        .toNumber(),
    }, // 1 * 10^(e-4)
    {
      n: 5 as const,
      m: 2 as IMantissa,
      step: new BigNumber(2)
        .multipliedBy(new BigNumber(10).pow(e - 4))
        .toNumber(),
    }, // 2 * 10^(e-4)
    {
      n: 5 as const,
      m: 5 as IMantissa,
      step: new BigNumber(5)
        .multipliedBy(new BigNumber(10).pow(e - 4))
        .toNumber(),
    }, // 5 * 10^(e-4)
  ];
}

/**
 * Map a given tickSize to the most appropriate (nSigFigs, mantissa) combination
 * Returns exact=true if perfect match found, otherwise returns nearest match
 */
function mapTickToParams(
  price: number,
  tickSize: number,
  eps = 1e-12,
): ITickParam {
  const pairs = allowedPairs(price);

  // Check for exact match
  const exact = pairs.find(
    (p) =>
      Math.abs(p.step - tickSize) <= Math.max(eps, Math.abs(p.step) * 1e-12),
  );

  if (exact) {
    return {
      targetTick: exact.step,
      nSigFigs: exact.n,
      mantissa: 'm' in exact ? exact.m : undefined,
      apiTick: exact.step,
      exact: true,
      multiplier: NaN, // Will be set by caller
      label: exact.step.toString(),
      value: exact.step.toString(),
    };
  }

  // Find nearest match by absolute error
  const nearestResult = pairs.reduce((best, p) => {
    const d = Math.abs(p.step - tickSize);
    return !best || d < best.d ? { p, d } : best;
  }, null as null | { p: ReturnType<typeof allowedPairs>[number]; d: number });
  const nearest = nearestResult!.p;

  return {
    targetTick: nearest.step,
    nSigFigs: nearest.n,
    mantissa: 'm' in nearest ? nearest.m : undefined,
    apiTick: nearest.step,
    exact: false,
    multiplier: NaN, // Will be set by caller
    label: nearest.step.toString(),
    value: nearest.step.toString(),
  };
}

/**
 * Generate UI options: decimals × [1,2,5,10,100,1000] mapped to HL subscription parameters
 *
 * @param price - Current market price
 * @param decimals - Base decimal step (e.g., 0.1 for prices like 4379.1)
 * @param multipliers - Array of multipliers to generate options
 * @returns Array of TickParam objects with nSigFigs/mantissa for each option
 */
export function buildTickOptions(
  price: number,
  decimals: number,
  multipliers?: number[],
): ITickParam[] {
  if (!(Number.isFinite(decimals) && decimals >= 0)) {
    throw new OneKeyError('decimals must be >= 0');
  }

  // Use different multipliers based on decimals value
  const defaultMultipliers =
    decimals === 0
      ? [1, 10, 20, 50, 100, 1000, 10_000] // For integer-only tokens
      : [0.1, 1, 2, 5, 10, 100, 1000]; // For decimal tokens

  const actualMultipliers = multipliers ?? defaultMultipliers;

  const results = actualMultipliers.map((mul) => {
    let target: number;

    if (decimals === 0) {
      // Special case for integer-only tokens (like BTC)
      target = mul;

      // Special handling for BTC decimals=0, targetTick=1 case
      if (target === 1) {
        return {
          targetTick: target,
          nSigFigs: null,
          mantissa: undefined,
          apiTick: target,
          exact: true,
          multiplier: mul,
          label: target.toString(),
          value: target.toString(),
        };
      }
    } else {
      // Use BigNumber for precise calculation to avoid floating point errors
      const decimalsBN = new BigNumber(decimals);
      const mulBN = new BigNumber(mul);
      const targetBN = decimalsBN.multipliedBy(mulBN);
      target = targetBN.toNumber();
    }

    const mapped = mapTickToParams(price, target);
    mapped.multiplier = mul;
    return mapped;
  });

  // Remove duplicates based on apiTick values
  const uniqueResults: ITickParam[] = [];
  const seenApiTicks = new Set<number>();

  for (const result of results) {
    // Use precise comparison for apiTick deduplication
    const roundedApiTick = new BigNumber(result.apiTick).toFixed(15);
    const apiTickKey = parseFloat(roundedApiTick);

    if (!seenApiTicks.has(apiTickKey)) {
      seenApiTicks.add(apiTickKey);
      uniqueResults.push(result);
    }
  }

  const sanitizedResults = uniqueResults.filter(
    (result) => result.targetTick >= 1e-6,
  );

  return sanitizedResults;
}

/**
 * Get the default tick option (usually the first exact match or smallest multiplier)
 */
export function getDefaultTickOption(options: ITickParam[]): ITickParam {
  // Prefer exact matches with smaller multipliers
  const exactMatch = options.find((opt) => opt.exact);
  if (exactMatch) return exactMatch;

  // Fallback to first option
  return options[0];
}

/**
 * Format tick size for display (e.g., 0.1, 1, 10, 100)
 */
export function formatTickSize(tickSize: number): string {
  if (tickSize >= 1) {
    return tickSize.toString();
  }

  // Count decimal places for small numbers
  const str = tickSize.toString();
  const decimalIndex = str.indexOf('.');
  if (decimalIndex === -1) return str;

  const decimalPlaces = str.length - decimalIndex - 1;
  return tickSize.toFixed(decimalPlaces);
}

/**
 * Validate if a TickParam has valid HyperLiquid API parameters
 */
export function isValidTickParam(param: ITickParam): boolean {
  const validNSigFigs: INSig[] = [2, 3, 4, 5, null];
  const validMantissa: IMantissa[] = [2, 5]; // Removed 1 to avoid WebSocket connection issues

  if (!validNSigFigs.includes(param.nSigFigs)) return false;

  if (param.nSigFigs === 5) {
    // Allow both mantissa values (2, 5) and undefined/null for nSigFigs=5
    return (
      param.mantissa === undefined || validMantissa.includes(param.mantissa)
    );
  }

  return param.mantissa === undefined;
}
