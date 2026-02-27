import { PixelRatio, Platform } from 'react-native';

const isAndroid: boolean = Platform.OS === 'android';

const ANDROID_UI_SCALE = 0.9;

/** Global UI scale factor. 0.9 on Android, 1.0 elsewhere. */
export const uiScale: number = isAndroid ? ANDROID_UI_SCALE : 1;

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
