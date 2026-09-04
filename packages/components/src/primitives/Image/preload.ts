import { Image, PixelRatio } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { buildTosImageResizeUrl } from '@onekeyhq/shared/src/utils/tosImageResizeUtils';

import { hasCustomSourceIdentity } from './optimization';

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
  if (!uri) {
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

export const preloadImages: IPreloadImagesFunc = async (sources, options) => {
  const hasUnsupportedHeaderSource = sources.some(
    (source) => source.uri && hasCustomSourceIdentity(source),
  );
  const uris = [
    ...new Set(
      sources
        .filter((source) => !hasCustomSourceIdentity(source))
        .map((source) => getPreloadUri(source, options))
        .filter((uri): uri is string => Boolean(uri)),
    ),
  ];
  if (!uris.length) {
    return !hasUnsupportedHeaderSource;
  }
  const results = await Promise.all(
    uris.map((uri) =>
      Image.prefetch(uri).then(
        (result) => result !== false,
        () => false,
      ),
    ),
  );
  return results.every(Boolean) && !hasUnsupportedHeaderSource;
};

export const preloadImage: IPreloadImageFunc = (source, options) =>
  preloadImages([source], options);
