import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';

const liquidityUnitMultiplierMap: Record<string, number> = {
  k: 10 ** 3,
  m: 10 ** 6,
  b: 10 ** 9,
  t: 10 ** 12,
};

export function parseFormattedLiquidityValue(value?: string): number {
  if (!value) {
    return 0;
  }

  const match = value.replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)([kmbt])?/i);
  if (!match) {
    return 0;
  }

  const parsedValue = Number(match[1]);
  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  const unit = match[2]?.toLowerCase();
  const multiplier = unit ? (liquidityUnitMultiplierMap[unit] ?? 1) : 1;

  return parsedValue * multiplier;
}

// Parse an APR/APY display string into a sortable number. Server copy may be
// a single value ("2.93"), a percent ("2.93%"), or a range
// ("2.00% - 2.67% APR") — Number() on those returns NaN, which made every
// sort value 0 and left the list order unchanged (walkthrough r3 issue 3).
// Use the maximum number in the string so range copy sorts by its upper bound.
export function parseAprPercentValue(value?: string): number {
  if (!value) {
    return 0;
  }
  const matches = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) {
    return 0;
  }
  return Math.max(...matches.map(Number).filter(Number.isFinite), 0);
}

// OK-59854: the server splits protocols into disjoint categories, so
// `simpleEarn` on its own drops every native-staking asset (SOL/BTC/ETH/APT/
// POL/ATOM live under `staking`). Both surfaces that present "tokens you can
// earn on" need the union; a symbol offered by both categories keeps its
// simple-earn entry, which carries the richer protocol list.
export function mergeSimpleEarnWithStakingAssets(
  simpleEarnAssets: IEarnAvailableAsset[],
  stakingAssets: IEarnAvailableAsset[],
): IEarnAvailableAsset[] {
  const simpleEarnSymbols = new Set(
    simpleEarnAssets.map((asset) => asset.symbol),
  );
  return [
    ...simpleEarnAssets,
    ...stakingAssets.filter((asset) => !simpleEarnSymbols.has(asset.symbol)),
  ];
}
