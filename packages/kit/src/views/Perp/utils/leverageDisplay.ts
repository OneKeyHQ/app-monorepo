function getPositiveFiniteNumber(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function clampLeverageToMax({
  leverage,
  maxLeverage,
}: {
  leverage: number | undefined;
  maxLeverage: number | undefined;
}) {
  const normalizedLeverage = getPositiveFiniteNumber(leverage);
  if (normalizedLeverage === undefined) {
    return undefined;
  }
  const normalizedMaxLeverage = getPositiveFiniteNumber(maxLeverage);
  return normalizedMaxLeverage === undefined
    ? normalizedLeverage
    : Math.min(normalizedLeverage, normalizedMaxLeverage);
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
  const normalizedMaxLeverage = getPositiveFiniteNumber(maxLeverage);
  return (
    clampLeverageToMax({ leverage: liveLeverage, maxLeverage }) ??
    clampLeverageToMax({ leverage: cachedLeverage, maxLeverage }) ??
    normalizedMaxLeverage ??
    1
  );
}

export function getPerpsFormLeverage({
  isSpot,
  liveLeverage,
  cachedLeverage: _cachedLeverage,
}: {
  isSpot: boolean;
  liveLeverage?: number;
  cachedLeverage?: number;
}) {
  if (isSpot) {
    return 1;
  }
  return getPositiveFiniteNumber(liveLeverage);
}
