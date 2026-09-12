const HEX_COLOR_PATTERN = /^#?([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const RGB_COLOR_PATTERN =
  /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*\.?\d+)\s*)?\)$/i;

function clampAlpha(alpha: number) {
  return Math.min(1, Math.max(0, alpha));
}

function formatAlpha(alpha: number) {
  return Number(clampAlpha(alpha).toFixed(4));
}

export function getChartColorWithAlpha(color: string, alpha: number) {
  const normalized = color.trim();
  const targetAlpha = clampAlpha(alpha);
  const hexMatch = normalized.match(HEX_COLOR_PATTERN);

  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split('')
        .map((character) => `${character}${character}`)
        .join('');
    }

    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    const sourceAlpha =
      hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;

    return `rgba(${red}, ${green}, ${blue}, ${formatAlpha(
      sourceAlpha * targetAlpha,
    )})`;
  }

  const rgbMatch = normalized.match(RGB_COLOR_PATTERN);
  if (rgbMatch) {
    const red = Math.round(Number(rgbMatch[1]));
    const green = Math.round(Number(rgbMatch[2]));
    const blue = Math.round(Number(rgbMatch[3]));
    const sourceAlpha = rgbMatch[4] === undefined ? 1 : Number(rgbMatch[4]);

    return `rgba(${red}, ${green}, ${blue}, ${formatAlpha(
      sourceAlpha * targetAlpha,
    )})`;
  }

  // Keep legacy/named colors intact instead of emitting color-mix(), which
  // lightweight-charts 5.2 cannot parse in Electron.
  return normalized;
}
