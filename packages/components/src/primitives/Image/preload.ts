import { Image, PixelRatio } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { buildTosImageResizeUrl } from '@onekeyhq/shared/src/utils/tosImageResizeUtils';

import { hasCustomSourceIdentity } from './optimization';
import { markPreloadedImageUri } from './preloadedImageUris';

import type {
  IPreloadImageFunc,
  IPreloadImageOptions,
  IPreloadImageSource,
  IPreloadImagesFunc,
} from './type';

const SHOULD_OPTIMIZE_RELATIVE_URL =
  platformEnv.isWeb || platformEnv.isWebEmbed;

function getPreloadUri(
  source: IPreloadImageSource,
  options?: IPreloadImageOptions,
) {
  const { uri } = source;
  if (!uri || hasCustomSourceIdentity(source)) {
    return undefined;
  }

  if (source.optimize === false) {
    return uri;
  }

  const result = buildTosImageResizeUrl({
    uri,
    resizeWidth: source.resizeWidth,
    displayWidth: source.width,
    displayHeight: source.height,
    pixelRatio: source.pixelRatio ?? options?.pixelRatio ?? PixelRatio.get(),
    allowRelativeUrl: SHOULD_OPTIMIZE_RELATIVE_URL,
  });

  return result.uri ?? uri;
}

async function prefetchUri(uri: string) {
  try {
    if ((await Image.prefetch(uri)) === false) return false;
    markPreloadedImageUri(uri);
    return true;
  } catch {
    return false;
  }
}

export const preloadImages: IPreloadImagesFunc = async (sources, options) => {
  const requests = new Map<string, Promise<boolean>>();
  const results = await Promise.all(
    sources.map(async (source) => {
      if (!source.uri) return true;
      const uri = getPreloadUri(source, options);
      if (uri) {
        const request = requests.get(uri) ?? prefetchUri(uri);
        requests.set(uri, request);
        if (await request) return true;
      }
      options?.onSourceError?.(source);
      return false;
    }),
  );
  return results.every(Boolean);
};

export const preloadImage: IPreloadImageFunc = (source, options) =>
  preloadImages([source], options);
