export const TOS_IMAGE_RESIZE_WIDTH_BUCKETS = [
  32, 40, 48, 64, 96, 128, 160, 200, 256, 320, 480, 640, 960, 1280,
] as const;

const TOS_IMAGE_RESIZE_ALLOWED_HOSTS = new Set([
  'app-assets.onekey.so',
  'uni.onekey-asset.com',
  'uni-test.onekey-asset.com',
  'common.onekey-asset.com',
  'asset.onekey-asset.com',
]);

const UNSUPPORTED_IMAGE_RESIZE_EXTENSIONS = [
  '.svg',
  '.mp4',
  '.webm',
  '.m4v',
  '.mov',
  '.avi',
] as const;

const SIGNED_IMAGE_URL_QUERY_KEYS = new Set([
  'expires',
  'policy',
  'signature',
  'token',
  'auth_key',
  'accesskeyid',
  'ossaccesskeyid',
  'security-token',
]);

const DEFAULT_MAX_PIXEL_RATIO = 3;
const DEFAULT_OVERSCAN_RATIO = 1.1;

export type ITosImageResizeSkipReason =
  | 'disabled'
  | 'emptyUrl'
  | 'invalidUrl'
  | 'unsupportedProtocol'
  | 'unsupportedHost'
  | 'alreadyProcessed'
  | 'signedUrl'
  | 'unsupportedExtension'
  | 'unknownSize';

export type ITosImageResizeResult = {
  optimized: boolean;
  uri?: string;
  targetWidth?: number;
  skipReason?: ITosImageResizeSkipReason;
};

export type IGetTosImageResizeTargetWidthParams = {
  resizeWidth?: number | null;
  displayWidth?: number | null;
  displayHeight?: number | null;
  pixelRatio?: number | null;
  maxPixelRatio?: number;
  overscanRatio?: number;
};

export type IBuildTosImageResizeUrlParams =
  IGetTosImageResizeTargetWidthParams & {
    uri?: string | null;
    enabled?: boolean;
    allowRelativeUrl?: boolean;
  };

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isStaticImageSize({
  displayWidth,
  displayHeight,
}: {
  displayWidth?: number | null;
  displayHeight?: number | null;
}) {
  return (
    isPositiveFiniteNumber(displayWidth) &&
    isPositiveFiniteNumber(displayHeight)
  );
}

function getNormalizedPixelRatio({
  pixelRatio,
  maxPixelRatio = DEFAULT_MAX_PIXEL_RATIO,
}: {
  pixelRatio?: number | null;
  maxPixelRatio?: number;
}) {
  const safePixelRatio = isPositiveFiniteNumber(pixelRatio) ? pixelRatio : 1;
  const safeMaxPixelRatio = isPositiveFiniteNumber(maxPixelRatio)
    ? maxPixelRatio
    : DEFAULT_MAX_PIXEL_RATIO;
  return Math.min(safePixelRatio, safeMaxPixelRatio);
}

function getBucketedWidth(width: number) {
  return (
    TOS_IMAGE_RESIZE_WIDTH_BUCKETS.find((bucket) => bucket >= width) ??
    TOS_IMAGE_RESIZE_WIDTH_BUCKETS[TOS_IMAGE_RESIZE_WIDTH_BUCKETS.length - 1]
  );
}

function hasExistingTosProcessParams(searchParams: URLSearchParams) {
  return Array.from(searchParams.keys()).some(
    (key) => key.toLowerCase() === 'x-tos-process',
  );
}

function hasExistingTosProcess(url: URL) {
  return hasExistingTosProcessParams(url.searchParams);
}

function hasSignedImageUrlSearchParams(searchParams: URLSearchParams) {
  return Array.from(searchParams.keys()).some((key) => {
    const normalizedKey = key.toLowerCase();
    return (
      SIGNED_IMAGE_URL_QUERY_KEYS.has(normalizedKey) ||
      normalizedKey.startsWith('x-amz-') ||
      normalizedKey.startsWith('x-oss-') ||
      normalizedKey.startsWith('x-tos-')
    );
  });
}

function hasSignedImageUrlParams(url: URL) {
  return hasSignedImageUrlSearchParams(url.searchParams);
}

function hasUnsupportedPathExtension(pathname: string) {
  const normalizedPathname = pathname.toLowerCase();
  return UNSUPPORTED_IMAGE_RESIZE_EXTENSIONS.some((extension) =>
    normalizedPathname.endsWith(extension),
  );
}

function hasUnsupportedExtension(url: URL) {
  return hasUnsupportedPathExtension(url.pathname);
}

function isRelativeImageUrl(uri: string) {
  return !/^[a-z][a-z\d+.-]*:/i.test(uri) && !uri.startsWith('//');
}

function getRelativeUriParts(uri: string) {
  const hashIndex = uri.indexOf('#');
  const uriWithoutHash = hashIndex >= 0 ? uri.slice(0, hashIndex) : uri;
  const hash = hashIndex >= 0 ? uri.slice(hashIndex) : '';
  const searchIndex = uriWithoutHash.indexOf('?');
  const pathname =
    searchIndex >= 0 ? uriWithoutHash.slice(0, searchIndex) : uriWithoutHash;
  const search = searchIndex >= 0 ? uriWithoutHash.slice(searchIndex + 1) : '';

  return {
    hash,
    pathname,
    searchParams: new URLSearchParams(search),
  };
}

function buildRelativeTosImageResizeUrl({
  rawUri,
  resizeWidth,
  displayWidth,
  displayHeight,
  pixelRatio,
  maxPixelRatio,
  overscanRatio,
}: IGetTosImageResizeTargetWidthParams & {
  rawUri: string;
}): ITosImageResizeResult {
  const { hash, pathname, searchParams } = getRelativeUriParts(rawUri);

  if (!pathname) {
    return { optimized: false, uri: rawUri, skipReason: 'invalidUrl' };
  }

  if (hasExistingTosProcessParams(searchParams)) {
    return { optimized: false, uri: rawUri, skipReason: 'alreadyProcessed' };
  }

  if (hasSignedImageUrlSearchParams(searchParams)) {
    return { optimized: false, uri: rawUri, skipReason: 'signedUrl' };
  }

  if (hasUnsupportedPathExtension(pathname)) {
    return {
      optimized: false,
      uri: rawUri,
      skipReason: 'unsupportedExtension',
    };
  }

  if (
    !isPositiveFiniteNumber(resizeWidth) &&
    !isStaticImageSize({ displayWidth, displayHeight })
  ) {
    return { optimized: false, uri: rawUri, skipReason: 'unknownSize' };
  }

  const targetWidth = getTosImageResizeTargetWidth({
    resizeWidth,
    displayWidth,
    displayHeight,
    pixelRatio,
    maxPixelRatio,
    overscanRatio,
  });

  if (!targetWidth) {
    return { optimized: false, uri: rawUri, skipReason: 'unknownSize' };
  }

  searchParams.set('x-tos-process', `image/resize,w_${targetWidth}`);
  const search = searchParams.toString();
  return {
    optimized: true,
    targetWidth,
    uri: `${pathname}${search ? `?${search}` : ''}${hash}`,
  };
}

export function getTosImageResizeTargetWidth({
  resizeWidth,
  displayWidth,
  displayHeight,
  pixelRatio,
  maxPixelRatio,
  overscanRatio = DEFAULT_OVERSCAN_RATIO,
}: IGetTosImageResizeTargetWidthParams) {
  let displaySize = isPositiveFiniteNumber(resizeWidth)
    ? resizeWidth
    : undefined;
  if (!displaySize) {
    const displaySizes = [displayWidth, displayHeight].filter(
      isPositiveFiniteNumber,
    );
    displaySize = displaySizes.length ? Math.max(...displaySizes) : undefined;
  }

  if (!isPositiveFiniteNumber(displaySize)) {
    return undefined;
  }

  const safeOverscanRatio = isPositiveFiniteNumber(overscanRatio)
    ? overscanRatio
    : DEFAULT_OVERSCAN_RATIO;
  const targetWidth = Math.ceil(
    displaySize *
      getNormalizedPixelRatio({ pixelRatio, maxPixelRatio }) *
      safeOverscanRatio,
  );

  return getBucketedWidth(targetWidth);
}

export function buildTosImageResizeUrl({
  uri,
  resizeWidth,
  displayWidth,
  displayHeight,
  pixelRatio,
  enabled = true,
  allowRelativeUrl = false,
  maxPixelRatio,
  overscanRatio,
}: IBuildTosImageResizeUrlParams): ITosImageResizeResult {
  const rawUri = typeof uri === 'string' ? uri.trim() : '';

  if (!enabled) {
    return {
      optimized: false,
      uri: rawUri || undefined,
      skipReason: 'disabled',
    };
  }

  if (!rawUri) {
    return { optimized: false, skipReason: 'emptyUrl' };
  }

  let url: URL;
  try {
    url = new URL(rawUri);
  } catch {
    if (allowRelativeUrl && isRelativeImageUrl(rawUri)) {
      return buildRelativeTosImageResizeUrl({
        rawUri,
        resizeWidth,
        displayWidth,
        displayHeight,
        pixelRatio,
        maxPixelRatio,
        overscanRatio,
      });
    }
    return { optimized: false, uri: rawUri, skipReason: 'invalidUrl' };
  }

  if (url.protocol !== 'https:') {
    return {
      optimized: false,
      uri: rawUri,
      skipReason: 'unsupportedProtocol',
    };
  }

  if (!TOS_IMAGE_RESIZE_ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    return { optimized: false, uri: rawUri, skipReason: 'unsupportedHost' };
  }

  if (hasExistingTosProcess(url)) {
    return { optimized: false, uri: rawUri, skipReason: 'alreadyProcessed' };
  }

  if (hasSignedImageUrlParams(url)) {
    return { optimized: false, uri: rawUri, skipReason: 'signedUrl' };
  }

  if (hasUnsupportedExtension(url)) {
    return {
      optimized: false,
      uri: rawUri,
      skipReason: 'unsupportedExtension',
    };
  }

  if (
    !isPositiveFiniteNumber(resizeWidth) &&
    !isStaticImageSize({ displayWidth, displayHeight })
  ) {
    return { optimized: false, uri: rawUri, skipReason: 'unknownSize' };
  }

  const targetWidth = getTosImageResizeTargetWidth({
    resizeWidth,
    displayWidth,
    displayHeight,
    pixelRatio,
    maxPixelRatio,
    overscanRatio,
  });

  if (!targetWidth) {
    return { optimized: false, uri: rawUri, skipReason: 'unknownSize' };
  }

  url.searchParams.set('x-tos-process', `image/resize,w_${targetWidth}`);
  return {
    optimized: true,
    targetWidth,
    uri: url.toString(),
  };
}
