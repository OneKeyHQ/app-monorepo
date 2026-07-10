import { PixelRatio } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ImageLoadOptions } from 'expo-image';

type IImageDecodeTarget = {
  width?: unknown;
  height?: unknown;
};

const ANDROID_MAX_DECODE_SIDE_PX = 2048;
const ANDROID_MIN_DECODE_SIDE_PX = 1;

function clampDecodeSidePx(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.min(
    ANDROID_MAX_DECODE_SIDE_PX,
    Math.max(ANDROID_MIN_DECODE_SIDE_PX, Math.ceil(value)),
  );
}

function getDevicePixelRatio() {
  const ratio = PixelRatio.get();
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

function resolveTargetSidePx(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return clampDecodeSidePx(value * getDevicePixelRatio());
}

export function getAndroidSafeImageLoadOptions(
  options: ImageLoadOptions = {},
  target?: IImageDecodeTarget,
): ImageLoadOptions {
  if (!platformEnv.isNativeAndroid) {
    return options;
  }

  // Image.loadAsync() defaults to original size on Android. Keep decoded ImageRefs
  // below Canvas draw limits before they are handed to ExpoImageView.
  const maxWidth =
    clampDecodeSidePx(options.maxWidth) ??
    resolveTargetSidePx(target?.width) ??
    ANDROID_MAX_DECODE_SIDE_PX;
  const maxHeight =
    clampDecodeSidePx(options.maxHeight) ??
    resolveTargetSidePx(target?.height) ??
    ANDROID_MAX_DECODE_SIDE_PX;

  return {
    ...options,
    maxWidth,
    maxHeight,
  };
}
