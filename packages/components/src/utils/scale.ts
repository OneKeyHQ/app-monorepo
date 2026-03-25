import { Dimensions, PixelRatio, Platform } from 'react-native';

const isAndroid: boolean = Platform.OS === 'android';

// Standard dp width threshold.
// Pixel/Samsung etc. typically report ~411dp (standard density) → no scaling needed.
// High-DPI OEM devices report ~360dp (higher density) → scale down to 0.9.
const STANDARD_DP_WIDTH_THRESHOLD = 400;

function getAndroidUiScale(): number {
  try {
    const dpWidth = Dimensions?.get?.('window')?.width ?? 0;
    if (dpWidth > 0) {
      return dpWidth >= STANDARD_DP_WIDTH_THRESHOLD ? 1 : 0.9;
    }
  } catch {
    // Dimensions not ready at module init time
  }
  return 0.9;
}

/** Global UI scale factor. Dynamic on Android based on dp width, 1.0 elsewhere. */
export const uiScale: number = isAndroid ? getAndroidUiScale() : 1;

/**
 * Scale a dimension value (spacing, size, border-radius).
 * Uses PixelRatio.roundToNearestPixel for crisp rendering on Android.
 * Preserves 0 and negative values.
 */
export function s(value: number): number {
  if (value === 0 || uiScale === 1) return value;
  const sign = value < 0 ? -1 : 1;
  const scaled = Math.abs(value) * uiScale;
  const rounded =
    typeof PixelRatio?.roundToNearestPixel === 'function'
      ? PixelRatio.roundToNearestPixel(scaled)
      : Math.round(scaled * 2) / 2;
  return sign * rounded;
}

/**
 * Scale a font size value.
 * Uses Math.round for integer font sizes (avoids RN text rendering artifacts).
 */
export function fs(value: number): number {
  if (value === 0 || uiScale === 1) return value;
  return Math.round(value * uiScale);
}
