import { PixelRatio } from 'react-native';

import {
  type Token,
  getTokenValue,
} from '@onekeyhq/components/src/shared/tamagui';
import { buildTosImageResizeUrl } from '@onekeyhq/shared/src/utils/tosImageResizeUtils';

import type { ImageSourcePropType, ImageURISource } from 'react-native';

type IImageSourceInput = ImageSourcePropType | string | number | undefined;

const STATIC_SIZE_TOKEN_VALUES: Record<string, number> = {
  '0': 0,
  px: 1,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '3.5': 14,
  '4': 16,
  '4.5': 18,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '9': 36,
  '10': 40,
  '11': 44,
  true: 44,
  '12': 48,
  '14': 56,
  '16': 64,
  '20': 80,
  '24': 96,
  '28': 112,
  '32': 128,
  '36': 144,
  '40': 160,
  '44': 176,
  '48': 192,
  '52': 208,
  '56': 224,
  '60': 240,
  '64': 256,
  '72': 288,
  '78': 312,
  '80': 320,
  '96': 384,
  '100': 400,
  '160': 640,
  '180': 720,
};

export type IOptimizedImageSourceResult = {
  source: ImageURISource | null;
  rawSource: ImageURISource | null;
  optimized: boolean;
  rawUri?: string;
  optimizedUri?: string;
};

function getPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function getStaticTokenSize(value: string) {
  if (!value.startsWith('$')) {
    return undefined;
  }

  try {
    const tokenValue = getTokenValue(value as Token, 'size');
    if (getPositiveNumber(tokenValue)) {
      return tokenValue;
    }
  } catch {
    // Fall back to the static token table below.
  }

  const fallbackValue = STATIC_SIZE_TOKEN_VALUES[value.slice(1)];
  return getPositiveNumber(fallbackValue) ? fallbackValue : undefined;
}

function getStaticStyleNumber(value: unknown): number | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = getStaticStyleNumber(item);
      if (result) {
        return result;
      }
    }
    return undefined;
  }

  if (getPositiveNumber(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return getStaticTokenSize(value.trim());
  }

  return undefined;
}

export function hasCustomSourceIdentity(source: IImageSourceInput) {
  if (!source || typeof source !== 'object') {
    return false;
  }

  if (Array.isArray(source)) {
    return true;
  }

  const imageSource = source as Partial<ImageURISource>;
  return Boolean(imageSource.headers);
}

function getPixelRatio(pixelRatio?: number) {
  if (typeof pixelRatio === 'number' && Number.isFinite(pixelRatio)) {
    return pixelRatio;
  }
  return (PixelRatio as { get?: () => number } | undefined)?.get?.() ?? 1;
}

export function buildOptimizedImageSource({
  source,
  resolvedSource,
  resizeWidth,
  width,
  height,
  pixelRatio,
  allowRelativeUrl,
}: {
  source: IImageSourceInput;
  resolvedSource: ImageURISource | null;
  resizeWidth?: unknown;
  width?: unknown;
  height?: unknown;
  pixelRatio?: number;
  allowRelativeUrl?: boolean;
}): IOptimizedImageSourceResult {
  const rawUri = resolvedSource?.uri;
  const result: IOptimizedImageSourceResult = {
    source: resolvedSource,
    rawSource: resolvedSource,
    optimized: false,
    rawUri: rawUri ?? undefined,
  };

  if (!rawUri || hasCustomSourceIdentity(source)) {
    return result;
  }

  const resizeResult = buildTosImageResizeUrl({
    uri: rawUri,
    resizeWidth: getStaticStyleNumber(resizeWidth),
    displayWidth: getStaticStyleNumber(width),
    displayHeight: getStaticStyleNumber(height),
    pixelRatio: getPixelRatio(pixelRatio),
    allowRelativeUrl,
  });

  if (!resizeResult.optimized || !resizeResult.uri) {
    return result;
  }

  return {
    source: {
      ...resolvedSource,
      uri: resizeResult.uri,
    },
    rawSource: resolvedSource,
    optimized: true,
    rawUri,
    optimizedUri: resizeResult.uri,
  };
}
