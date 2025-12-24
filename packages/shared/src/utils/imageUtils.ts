/* eslint-disable no-plusplus */
import {
  downloadAsync as ExpoFSDownloadAsync,
  getInfoAsync as ExpoFSGetInfoAsync,
  makeDirectoryAsync as ExpoFSMakeDirectoryAsync,
  readAsStringAsync as ExpoFSReadAsStringAsync,
  writeAsStringAsync as ExpoFSWriteAsStringAsync,
  cacheDirectory,
} from 'expo-file-system/legacy';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { isArray, isNil, isNumber, isObject, isString } from 'lodash';
import { Image as RNImage } from 'react-native';
import { canvasRGBA as blurCanvasRGBA } from 'stackblur-canvas';

import {
  HomeScreenNotSupportFormatError,
  OneKeyAppError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';

import appGlobals from '../appGlobals';
import { defaultLogger } from '../logger/logger';
import platformEnv from '../platformEnv';

import bufferUtils from './bufferUtils';

import type {
  Action as ExpoImageManipulatorAction,
  ImageResult,
} from 'expo-image-manipulator';
import type { ImageSourcePropType } from 'react-native';

type ICommonImageLogFn = (...args: string[]) => void;

type ILocalImageUri = {
  base64Uri: string;
  nativeUri?: string; // only Native .file:/// path
};

const range = (length: number) => [...Array(length).keys()];

export const toGrayScale = (red: number, green: number, blue: number): number =>
  Math.round(0.299 * red + 0.587 * green + 0.114 * blue);

export function getOriginX(
  originW: number,
  originH: number,
  scaleW: number,
  scaleH: number,
) {
  const width = Math.ceil((scaleH / originH) * originW);
  if (width <= scaleW) {
    return null;
  }
  const originX = Math.ceil(Math.ceil(width / 2) - Math.ceil(scaleW / 2));
  return originX;
}

function isHttpUri(uri: string): boolean {
  return /^https?:\/\//.test(uri);
}

function isBase64Uri(uri: string): boolean {
  return /^data:image\/\w+;base64,/.test(uri);
}

function prefixBase64Uri(base64: string, mime: string): string {
  if (!base64) {
    return base64;
  }
  if (isBase64Uri(base64)) {
    return base64;
  }
  return `data:${mime || 'image/jpeg'};base64,${base64}`;
}

function stripBase64UriPrefix(base64Uri: string): string {
  return base64Uri.replace(/^data:image\/\w+;base64,/, '');
}

function convertToBlackAndWhiteImageBase64(
  colorImageBase64: string,
  mime: string,
): Promise<string> {
  if (platformEnv.isNative) {
    return appGlobals.$webembedApiProxy.imageUtils.convertToBlackAndWhiteImageBase64(
      colorImageBase64,
      mime,
    );
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('ctx is null'));
        return;
      }
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let whiteCount = 0;

      // TODO optimize this
      // https://github.com/trezor/homescreen-editor/blob/gh-pages/js/main.js#L234
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (avg > 128) {
          whiteCount += 4;
        }
        const bw = avg > 128 ? 255 : 0;
        // const bw = avg > 128 ? 0 : 255;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
      }

      // reverse color if white part is more than half
      if (whiteCount > data.length / 2) {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const bwImageBase64 = canvas.toDataURL(mime || 'image/jpeg');
      resolve(bwImageBase64);
    };

    img.onerror = reject;
    img.src = prefixBase64Uri(colorImageBase64, mime || 'image/jpeg');
  });
}

function buildHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (e) => reject(e);
    image.src = dataUrl;
  });
}

function htmlImageToCanvas({
  image,
  width,
  height,
}: {
  image: HTMLImageElement;
  width: number;
  height: number;
}) {
  const canvas = document.createElement('canvas');
  canvas.height = height;
  canvas.width = width;

  const ctx = canvas.getContext('2d');
  if (ctx == null) {
    throw new OneKeyLocalError('2D context is null');
  }

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0);

  return { canvas, ctx };
}

/**
 * Convert SVG to JPEG base64
 * @param {string} svgUri - SVG URI (can be data URI or http URL)
 * @returns {Promise<string>} JPEG base64 string with data URI prefix
 */
async function convertSvgToJpegBase64(uri: string): Promise<string> {
  if (!uri) {
    throw new OneKeyLocalError('SVG URI is required');
  }

  if (platformEnv.isNative) {
    throw new HomeScreenNotSupportFormatError({
      info: {
        token: 'svg',
      },
    });
  }

  const img = await buildHtmlImage(uri);

  try {
    const imgWidth = img.naturalWidth || img.width;
    const imgHeight = img.naturalHeight || img.height;

    if (imgWidth === 0 || imgHeight === 0) {
      throw new OneKeyLocalError('Invalid SVG dimensions');
    }

    const canvasWidth = imgWidth;
    const canvasHeight = imgHeight;

    const { canvas, ctx } = htmlImageToCanvas({
      image: img,
      width: canvasWidth,
      height: canvasHeight,
    });

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

    const jpegBase64Uri = canvas.toDataURL('image/jpeg');
    return jpegBase64Uri;
  } catch (error) {
    throw new OneKeyLocalError(
      `Failed to convert SVG: ${(error as Error).message}`,
    );
  }
}

function drawRoundRectPath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (r === 0) {
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.closePath();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(width - r, 0);
  ctx.quadraticCurveTo(width, 0, width, r);
  ctx.lineTo(width, height - r);
  ctx.quadraticCurveTo(width, height, width - r, height);
  ctx.lineTo(r, height);
  ctx.quadraticCurveTo(0, height, 0, height - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
}

async function applyRoundedCorners({
  base64,
  width,
  height,
  radius,
  backgroundColor = '#000000',
}: {
  base64: string;
  width: number;
  height: number;
  radius: number;
  backgroundColor?: string;
}): Promise<string> {
  if (!base64 || radius <= 0) {
    return base64;
  }

  if (platformEnv.isNative) {
    return appGlobals.$webembedApiProxy.imageUtils.applyRoundedCorners({
      base64,
      width,
      height,
      radius,
      backgroundColor,
    });
  }

  if (typeof document === 'undefined') {
    return base64;
  }

  const dataUrl = prefixBase64Uri(base64, 'image/jpeg');
  const image = await buildHtmlImage(dataUrl);

  const targetWidth = width || image.width || 0;
  const targetHeight = height || image.height || 0;

  if (targetWidth === 0 || targetHeight === 0) {
    return base64;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new OneKeyLocalError('2D context is null');
  }

  ctx.fillStyle = backgroundColor ?? '#000000';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  ctx.save();
  drawRoundRectPath(ctx, targetWidth, targetHeight, radius);
  ctx.clip();
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
  ctx.restore();

  const roundedBase64Uri = canvas.toDataURL('image/jpeg');
  return stripBase64UriPrefix(roundedBase64Uri);
}

export type IResizeImageResult = {
  hex: string;
  uri: string;
  width: number;
  height: number;
  base64?: string;
};

async function resizeImage(params: {
  uri: string;
  width: number;
  height: number;
  originW: number;
  originH: number;
  isMonochrome?: boolean;
  compress?: number;
  cornerRadius?: number;
  cornerBackgroundColor?: string;
}): Promise<IResizeImageResult> {
  const {
    uri,
    width,
    height,
    isMonochrome,
    compress,
    originW,
    originH,
    cornerRadius = 0,
    cornerBackgroundColor,
  } = params;
  if (!uri) return { hex: '', uri: '', width: 0, height: 0 };

  // Handle invalid origin dimensions - detect actual image size first
  let actualOriginW = originW;
  let actualOriginH = originH;
  if (originW <= 0 || originH <= 0) {
    console.warn(
      `Invalid origin dimensions: originW=${originW}, originH=${originH}. Detecting actual image size...`,
    );
    try {
      // Perform a no-op manipulation to get actual image dimensions
      const detectResult: ImageResult = await manipulateAsync(uri, [], {
        compress: 1, // 100% quality, no compression
        format: SaveFormat.JPEG,
      });
      actualOriginW = detectResult.width;
      actualOriginH = detectResult.height;
    } catch (error) {
      console.error('Failed to detect image dimensions:', error);
      return { hex: '', uri: '', width: 0, height: 0 };
    }
  }

  const actions: ExpoImageManipulatorAction[] = [];

  // Skip processing if image is already at exact target size
  if (actualOriginW === width && actualOriginH === height) {
    defaultLogger.hardware.homescreen.recordImageCompression({
      target: `${width}x${height}`,
      origin: `${actualOriginW}x${actualOriginH}`,
      scale: '1.00',
      actual: 'skipped - already exact size',
    });
    // No actions needed, image is already perfect
  } else {
    // Calculate the scale ratio to ensure the resized image covers the target dimensions
    // Use the larger ratio to ensure the image fills the target area
    const scaleRatioW = width / actualOriginW;
    const scaleRatioH = height / actualOriginH;
    const scaleRatio = Math.max(scaleRatioW, scaleRatioH);

    // Calculate the actual size after scaling
    // Add a small margin (1.02) ONLY when scaling up to avoid potential precision issues
    // When scaling down, use exact ratio to minimize unnecessary cropping
    const precisionBuffer = scaleRatio > 1 ? 1.02 : 1.0;
    const actualHeight = Math.ceil(
      actualOriginH * scaleRatio * precisionBuffer,
    );
    const actualWidth = Math.ceil(actualOriginW * scaleRatio * precisionBuffer);

    defaultLogger.hardware.homescreen.recordImageCompression({
      target: `${width}x${height}`,
      origin: `${actualOriginW}x${actualOriginH}`,
      scale: scaleRatio.toFixed(2),
      actual: `${actualWidth}x${actualHeight}`,
    });

    // Step 1: Resize to intermediate size (larger than or equal to target)
    // Use height-based resize to maintain aspect ratio
    actions.push({
      resize: {
        height: actualHeight,
      },
    });

    // Step 2: Always crop to exact target dimensions
    // Calculate crop origin to center the crop
    const cropOriginX = Math.max(0, Math.floor((actualWidth - width) / 2));
    const cropOriginY = Math.max(0, Math.floor((actualHeight - height) / 2));

    actions.push({
      crop: {
        height,
        width,
        originX: cropOriginX,
        originY: cropOriginY,
      },
    });
  }

  const imageResult: ImageResult = await manipulateAsync(uri, actions, {
    compress: compress || 0.8,
    format: SaveFormat.JPEG,
    base64: true,
  });

  if (isMonochrome && imageResult?.base64) {
    let bwBase64 = await convertToBlackAndWhiteImageBase64(
      imageResult.base64,
      'image/png', // image/jpeg will cause more noise on the image
    );
    bwBase64 = stripBase64UriPrefix(bwBase64);
    imageResult.base64 = bwBase64;
  }

  if (cornerRadius > 0 && imageResult?.base64) {
    const roundedBase64 = await applyRoundedCorners({
      base64: imageResult.base64,
      width: imageResult.width,
      height: imageResult.height,
      radius: cornerRadius,
      backgroundColor: cornerBackgroundColor,
    });
    imageResult.base64 = roundedBase64;
  }

  const buffer = Buffer.from(imageResult.base64 ?? '', 'base64');
  const hex = bufferUtils.bytesToHex(buffer);
  return { ...imageResult, hex };
}

/**
 * Detect MIME type from file magic bytes (file signature)
 */
function detectMimeTypeFromMagicBytes(base64: string): string | null {
  if (!base64) return null;

  // Get first few bytes from base64
  // 32 base64 chars = ~24 bytes, enough for most file signatures
  const bytes = base64.length > 32 ? base64.substring(0, 32) : base64;

  // Common file signatures (magic bytes)
  // JPEG: FF D8 FF
  if (bytes.startsWith('/9j/')) return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (bytes.startsWith('iVBORw0KGgo')) return 'image/png';
  // GIF: 47 49 46 38
  if (bytes.startsWith('R0lGOD')) return 'image/gif';
  // WebP: RIFF....WEBP
  if (bytes.includes('UklGR') && bytes.includes('V0VCUA')) return 'image/webp';
  // SVG: <?xml, <svg, or whitespace + <svg (common patterns)
  // PD94bWw = <?xml, PHN2Zw = <svg, CiAgICA8c3Zn = \n    <svg
  if (
    bytes.startsWith('PD94bWw') ||
    bytes.startsWith('PHN2Zw') ||
    bytes.includes('PHN2Zw') ||
    bytes.includes('c3ZnI')
  ) {
    return 'image/svg+xml';
  }
  // BMP: 42 4D
  if (bytes.startsWith('Qk')) return 'image/bmp';

  // Video formats
  // MP4: starts with various ftyp boxes
  if (bytes.includes('ZnR5cA') || bytes.includes('bW9vdg')) return 'video/mp4';
  // WebM: 1A 45 DF A3
  if (bytes.startsWith('GkXfo')) return 'video/webm';

  return null;
}

function getBlacklistByMimetype(mimetype: string) {
  const mimeTypeMap: Record<string, string> = {
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'application/json': 'json',
    'text/html': 'html',
  };

  const extension = mimeTypeMap[mimetype];
  if (extension) {
    return extension;
  }

  if (mimetype.startsWith('video/')) {
    return 'video';
  }

  return undefined;
}

/**
 * Detect file format from URI extension
 */
function detectFileFormatFromUri(uri: string): {
  extension: string;
  mimeType: string;
} {
  // Extract extension from URI (handle query params)
  const urlPath = uri.split('?')[0];
  const expectedExtension = urlPath.split('.').pop()?.toLowerCase() || '';

  // MIME type mapping for images
  const mimeTypeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    mp4: 'video/mp4',
  };

  const mimeType = mimeTypeMap[expectedExtension];
  const extension = mimeType ? expectedExtension : 'jpg';

  return {
    extension,
    mimeType: mimeType || 'image/jpeg',
  };
}

async function getRNLocalImageBase64({
  nativeModuleId: _nativeModuleId,
  uri,
  logFn,
}: {
  nativeModuleId?: number;
  uri: string;
  logFn?: ICommonImageLogFn;
}) {
  const errors: string[] = [];
  let downloadedUri: string | undefined | null;
  let downloadedUri1: string | undefined | null;
  let downloadedUri2: string | undefined | null;
  let base64a: string | undefined;
  let base64a1: string | undefined;
  let base64b: string | undefined;
  let base64c: string | undefined;
  let base64d: string | undefined;

  // **** use expo-file-system
  try {
    base64a = await ExpoFSReadAsStringAsync(uri, {
      encoding: 'base64',
    });
  } catch (error) {
    errors.push(
      'ExpoFSReadAsStringAsync error',
      (error as Error)?.message || '',
    );
  }

  // **** use expo-asset
  // https://stackoverflow.com/a/77425150
  //
  // if (isNumber(nativeModuleId)) {
  //   try {
  //     const loadAsyncResult = await Asset.loadAsync(nativeModuleId);
  //     downloadedUri = loadAsyncResult?.[0]?.localUri;
  //     downloadedUri1 = (loadAsyncResult || [])
  //       .map((item) => item?.uri || '')
  //       .join(',');
  //     downloadedUri2 = (loadAsyncResult || [])
  //       .map((item) => item?.localUri || '')
  //       .join(',');
  //     if (downloadedUri) {
  //       base64a1 = await ExpoFSReadAsStringAsync(downloadedUri, {
  //         encoding: 'base64',
  //       });
  //     }
  //   } catch (error) {
  //     errors.push(
  //       'ExpoFSReadAsStringAsync downloadedUri error',
  //       (error as Error)?.message || '',
  //     );
  //   }
  // }

  // **** use react-native-image-base64
  // import RNImgToBase64 from 'react-native-image-base64';
  //
  // try {
  //   base64b = await RNImgToBase64.getBase64String(uri);
  // } catch (error) {
  //   errors.push(
  //     'RNImgToBase64.getBase64String error',
  //     (error as Error)?.message || '',
  //   );
  // }

  // **** use react-native-fs
  // try {
  //   base64c = await RNFS.readFile(uri, 'base64');
  // } catch (error) {
  //   errors.push('RNFS.readFile error', (error as Error)?.message || '');
  // }
  //
  let uri2: string | undefined;
  // try {
  //   uri2 = RNFS.MainBundlePath + uri;
  //   base64d = await RNFS.readFile(uri2, 'base64');
  // } catch (error) {
  //   errors.push('RNFS.readFile uri2 error', (error as Error)?.message || '');
  // }

  logFn?.('getRNLocalImageBase64 errors', errors.join('  |||   '));
  logFn?.('getRNLocalImageBase64 uris', uri, downloadedUri || '', uri2 || '');
  logFn?.('getRNLocalImageBase64 downloadedUri', downloadedUri || '');
  logFn?.('getRNLocalImageBase64 downloadedUri1', downloadedUri1 || '');
  logFn?.('getRNLocalImageBase64 downloadedUri2', downloadedUri2 || '');
  logFn?.(
    'getRNLocalImageBase64 base64',
    base64a || '',
    base64a1 || '',
    base64b || '',
    base64c || '',
    base64d || '',
  );

  const base64 = base64a || base64a1 || base64b || base64c || base64d;
  if (!base64) {
    throw new OneKeyLocalError('getRNLocalImageBase64 failed');
  }

  return base64;
}

async function getNativeCacheDirectory() {
  const tempDir = cacheDirectory || '';
  if (!tempDir) {
    throw new OneKeyLocalError('No cache or document directory available');
  }

  const subDir = `${tempDir}react-native-image-crop-picker/`;

  try {
    // Ensure subdirectory exists
    const dirInfo = await ExpoFSGetInfoAsync(subDir);
    if (!dirInfo.exists) {
      await ExpoFSMakeDirectoryAsync(subDir, { intermediates: true });
    }
  } catch (dirError) {
    throw new OneKeyLocalError(
      `Failed to create directory: ${(dirError as Error).message}`,
    );
  }

  return subDir;
}

async function nativeSaveBase64ToCache({
  savedPath,
  uri,
  logFn,
}: {
  savedPath: string;
  uri: string;
  logFn?: (...args: any[]) => void;
}) {
  await ExpoFSWriteAsStringAsync(savedPath, uri, {
    encoding: 'base64',
  });

  // Verify file was created
  const fileInfo = await ExpoFSGetInfoAsync(savedPath);
  if (!fileInfo.exists) {
    logFn?.('getBase64FromImageUriNative: file was not created');
  }

  return fileInfo.uri;
}

async function nativeSaveBaseUriToCache({
  ext,
  uri,
  logFn,
}: {
  ext: string;
  uri: string;
  logFn?: (...args: any[]) => void;
}): Promise<{
  uri: string;
  mimetype?: string;
}> {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10_000);
  const fileName = `temp-image-crop-${timestamp}-${random}.${ext}`;

  const cacheDir = await getNativeCacheDirectory();
  const savedPath = `${cacheDir}${fileName}`;

  let newUri = uri;
  let mimetype;
  if (isHttpUri(uri)) {
    logFn?.('(native) download remote image', savedPath, uri);

    // eslint-disable-next-line no-param-reassign
    const result = await ExpoFSDownloadAsync(uri, savedPath);
    mimetype = result.headers?.['content-type'];
    newUri = result.uri;
    logFn?.('(native) download to local uri', uri);
  } else if (isBase64Uri(uri)) {
    newUri = await nativeSaveBase64ToCache({ uri, savedPath, logFn });
  }

  return { uri: newUri, mimetype };
}

async function getBase64FromImageUriNative({
  nativeModuleId,
  uri,
  logFn,
}: {
  nativeModuleId?: number;
  uri: string;
  logFn?: ICommonImageLogFn;
}): Promise<ILocalImageUri | undefined> {
  try {
    // Try to detect format from URI first
    const formatInfo = detectFileFormatFromUri(uri);

    let downloadMimeType;
    // remote uri
    if (isHttpUri(uri)) {
      // Use detected extension, fallback to jpg
      const ext = formatInfo.extension || 'jpg';
      const res = await nativeSaveBaseUriToCache({ ext, uri, logFn });
      // eslint-disable-next-line no-param-reassign
      uri = res.uri;
      downloadMimeType = res.mimetype;
    }

    const base64 = await getRNLocalImageBase64({
      nativeModuleId,
      uri,
      logFn,
    });
    logFn?.('(native) local uri to base64', uri);

    // Detect actual MIME type from file content (magic bytes)
    const detectedMimeType = detectMimeTypeFromMagicBytes(base64);
    const finalMimeType =
      downloadMimeType || detectedMimeType || formatInfo.mimeType;

    // Check if it's a video format
    const blockMimetype = getBlacklistByMimetype(finalMimeType);

    if (blockMimetype) {
      logFn?.(
        '(native) video format not supported for base64 conversion',
        blockMimetype,
      );
      throw new HomeScreenNotSupportFormatError({
        info: {
          token: blockMimetype,
        },
      });
    }

    const base64Uri = prefixBase64Uri(base64, finalMimeType);
    return {
      base64Uri,
      nativeUri: platformEnv.isNative ? uri : undefined,
    };
  } catch (error) {
    logFn?.(
      '(native) local uri to base64 ERROR',
      uri,
      (error as Error | undefined)?.message || 'unknown error',
    );
    if (error instanceof OneKeyAppError) {
      throw error;
    }
    return undefined;
  }
}

async function getBase64FromImageUriWeb(
  uri: string,
): Promise<ILocalImageUri | undefined> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      // eslint-disable-next-line spellcheck/spell-checker
      reader.onloadend = async () => {
        let readerResult = reader.result as string;

        if (readerResult.includes('image/svg+xml;base64')) {
          readerResult = await convertSvgToJpegBase64(readerResult);
        }

        // readerResult is base64 string with mime prefix
        resolve({ base64Uri: readerResult });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    return undefined;
  }
}

async function getBase64FromImageUri({
  uri,
  nativeModuleId,
  logFn,
}: {
  uri: string | undefined;
  nativeModuleId?: number;
  logFn?: ICommonImageLogFn;
}): Promise<ILocalImageUri | undefined> {
  if (!uri) {
    return undefined;
  }

  if (isBase64Uri(uri)) {
    return { base64Uri: uri };
  }

  if (platformEnv.isNative) {
    return getBase64FromImageUriNative({
      nativeModuleId,
      uri,
      logFn,
    });
  }
  return getBase64FromImageUriWeb(uri);
}

async function getUriFromRequiredImageSource(
  source: ImageSourcePropType | string | undefined,
  logFn?: ICommonImageLogFn,
): Promise<string | undefined> {
  try {
    logFn?.(
      'ImageSource type',
      `isString=${isString(source).toString()}`,
      `isArray=${isArray(source).toString()}`,
      `isNumber=${isNumber(source).toString()}`,
      `isNil=${isNil(source).toString()}`,
      `isObject=${isObject(source) ? Object.keys(source).join(',') : 'false'}`,
    );
  } catch (error) {
    // ignore
  }

  if (platformEnv.isNative && !isNil(source) && !isString(source)) {
    if (isNumber(source)) {
      try {
        logFn?.('(native) ImageSource number', source.toString());
      } catch (error) {
        // ignore
      }
    }
    const resolvedAssetSource = RNImage.resolveAssetSource(source);
    const uri = resolvedAssetSource.uri;
    logFn?.(
      '(native) ImageSource resolved to local uri',
      uri,
      resolvedAssetSource.uri,
    );
    return uri;
  }
  if (typeof source === 'string') {
    logFn?.('ImageSource is string', source);
    return source;
  }
  if (isArray(source)) {
    logFn?.('ImageSource is array');
    return undefined;
  }
  if (isNumber(source)) {
    logFn?.('ImageSource is number', source.toString());
    return undefined;
  }
  logFn?.('ImageSource source.uri', source?.uri || '');
  return source?.uri;
}

async function getBase64FromRequiredImageSource(
  source: ImageSourcePropType | string | undefined,
  logFn?: ICommonImageLogFn,
): Promise<string | undefined> {
  const uri = await getUriFromRequiredImageSource(source, logFn);
  logFn?.('getUriFromRequiredImageSource uri', uri || '');
  const imageUri = await getBase64FromImageUri({
    nativeModuleId: isNumber(source) ? source : undefined,
    uri,
    logFn,
  });

  if (!imageUri?.base64Uri) {
    return undefined;
  }
  return imageUri.base64Uri;
}

async function prepareImageForCrop(
  source: ImageSourcePropType | string | undefined,
  logFn?: ICommonImageLogFn,
): Promise<string | undefined> {
  // Get source URI first
  const uri = await getUriFromRequiredImageSource(source, logFn);
  logFn?.('prepareImageForCrop uri', uri || '');

  // Get full image info (base64 + native URI)
  const imageUri = await getBase64FromImageUri({
    nativeModuleId: isNumber(source) ? source : undefined,
    uri,
    logFn,
  });

  if (!imageUri?.base64Uri) {
    throw new OneKeyLocalError('Failed to process image source');
  }

  // Validate platform-specific requirements
  if (platformEnv.isNative) {
    return imageUri.nativeUri;
  }

  return imageUri.base64Uri;
}

function canvasImageDataToBitmap({
  imageData,
  width,
  height,
}: {
  imageData: ImageData;
  width: number;
  height: number;
}) {
  const homescreen = range(height)
    .map((j) =>
      range(width / 8)
        .map((i) => {
          const byteString = range(8)
            .map((k) => (j * width + i * 8 + k) * 4)
            .map((index) => (imageData.data[index] === 0 ? '0' : '1'))
            .join('');

          return String.fromCharCode(Number.parseInt(byteString, 2));
        })
        .join(''),
    )
    .join('');
  const hex = homescreen
    .split('')
    .map((letter) => letter.charCodeAt(0))
    // eslint-disable-next-line no-bitwise
    .map((charCode) => charCode & 0xff)
    .map((charCode) => charCode.toString(16))
    .map((chr) => (chr.length < 2 ? `0${chr}` : chr))
    .join('');

  // if image is all white or all black, return empty string
  if (/^f+$/.test(hex) || /^0+$/.test(hex)) {
    return '';
  }

  return hex;
}

async function base64ImageToBitmap({
  base64,
  width,
  height,
}: {
  base64: string;
  width: number;
  height: number;
}): Promise<string> {
  if (platformEnv.isNative) {
    return appGlobals.$webembedApiProxy.imageUtils.base64ImageToBitmap({
      base64,
      width,
      height,
    });
  }

  const image = await buildHtmlImage(base64);
  const { canvas, ctx } = htmlImageToCanvas({ image, width, height });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return canvasImageDataToBitmap({ imageData, width, height });
}

async function getBase64ImageFromUrl(imageUrl: string) {
  const res = await fetch(imageUrl);
  const blob = await res.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener(
      'load',
      () => {
        resolve(reader.result);
      },
      false,
    );

    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

/**
 * core method for image blur
 * @param {string} base64Data - Base64 string
 * @param {number} blurRadius - blur radius (0-300, recommended 200)
 * @param {number} overlayOpacity - black mask opacity (0-1, recommended 0.2)
 * @returns {Promise<string>} processed base64 string
 */
async function processImageBlur({
  base64Data,
  blurRadius = 100,
  overlayOpacity = 0.2,
}: {
  base64Data: string;
  blurRadius?: number;
  overlayOpacity?: number;
}): Promise<{
  hex: string;
  width: number;
  height: number;
}> {
  if (platformEnv.isNative) {
    return appGlobals.$webembedApiProxy.imageUtils.processImageBlur({
      base64Data,
      blurRadius,
      overlayOpacity,
    });
  }

  if (!base64Data || typeof base64Data !== 'string') {
    throw new OneKeyLocalError('Invalid base64 data');
  }

  if (!base64Data.startsWith('data:image/')) {
    throw new OneKeyLocalError('base64 data must be image format');
  }

  const img = await buildHtmlImage(base64Data);

  try {
    // 1. create canvas
    const { canvas, ctx } = htmlImageToCanvas({
      image: img,
      width: img.width,
      height: img.height,
    });

    // 2. add black semi-transparent mask
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalCompositeOperation = 'source-over';

    // 3. apply blur effect
    if (blurRadius > 0) {
      try {
        blurCanvasRGBA(
          canvas,
          0,
          0,
          canvas.width,
          canvas.height,
          Math.min(blurRadius, 300),
        );
      } catch (blurError) {
        console.warn('blur processing failed, skip blur effect:', blurError);
      }
    }

    const base64Uri = canvas.toDataURL('image/jpeg');

    const base64 = stripBase64UriPrefix(base64Uri);
    const buffer = Buffer.from(base64, 'base64');
    const hex = bufferUtils.bytesToHex(buffer);

    return {
      hex: hex || '',
      width: canvas.width,
      height: canvas.height,
    };
  } catch (error) {
    throw new OneKeyLocalError(
      `Canvas processing failed: ${(error as Error).message}`,
    );
  }
}

function base64ImageToBlob(base64String: string) {
  const arr = base64String.split(',');
  if (!arr[0] || !arr[1]) {
    throw new OneKeyLocalError('Invalid base64 string');
  }
  const mime = arr[0].match(/:(.*?);/)?.[1];
  if (!mime) {
    throw new OneKeyLocalError('Invalid mime type');
  }
  const data = atob(arr[1]);
  let n = data.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = data.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export default {
  resizeImage,
  processImageBlur,
  prefixBase64Uri,
  stripBase64UriPrefix,
  convertToBlackAndWhiteImageBase64,
  getUriFromRequiredImageSource,
  getBase64FromRequiredImageSource,
  getBase64FromImageUri,
  base64ImageToBitmap,
  buildHtmlImage,
  getBase64ImageFromUrl,
  applyRoundedCorners,
  prepareImageForCrop,
  base64ImageToBlob,
};
