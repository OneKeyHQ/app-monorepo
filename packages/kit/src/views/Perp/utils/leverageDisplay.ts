function getPositiveFiniteNumber(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export function getPerpsDisplayLeverage({
  liveLeverage,
  cachedLeverage,
  maxLeverage,
}: {
  liveLeverage?: number;
  cachedLeverage?: number;
  maxLeverage?: number;
}) {
  return (
    getPositiveFiniteNumber(liveLeverage) ??
    getPositiveFiniteNumber(cachedLeverage) ??
    getPositiveFiniteNumber(maxLeverage) ??
    1
  );
}

export function getPerpsFormLeverage({
  isSpot,
  liveLeverage,
  cachedLeverage,
}: {
  isSpot: boolean;
  liveLeverage?: number;
  cachedLeverage?: number;
}) {
  if (isSpot) {
    return 1;
  }
  return (
    getPositiveFiniteNumber(liveLeverage) ??
    getPositiveFiniteNumber(cachedLeverage)
  );
}
