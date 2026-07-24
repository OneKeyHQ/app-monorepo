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
