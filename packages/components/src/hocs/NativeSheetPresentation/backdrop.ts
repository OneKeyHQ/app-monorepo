const LIGHT_BACKDROP_DIM_AMOUNT = 68 / 255;

export function getNativeSheetBackdropDimAmount(color: string) {
  const normalizedColor = color.trim();
  if (/^#[\dA-Fa-f]{8}$/.test(normalizedColor)) {
    return Number.parseInt(normalizedColor.slice(7, 9), 16) / 255;
  }
  if (/^#[\dA-Fa-f]{4}$/.test(normalizedColor)) {
    const alpha = normalizedColor.slice(4, 5);
    return Number.parseInt(`${alpha}${alpha}`, 16) / 255;
  }
  const rgbaMatch = normalizedColor.match(
    /^rgba\([^,]+,[^,]+,[^,]+,\s*(\d*\.?\d+)\s*\)$/,
  );
  return rgbaMatch
    ? Math.min(1, Math.max(0, Number(rgbaMatch[1])))
    : LIGHT_BACKDROP_DIM_AMOUNT;
}
