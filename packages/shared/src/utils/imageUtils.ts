/* eslint-disable no-plusplus */
import {
  copyAsync as ExpoFSCopyAsync,
  deleteAsync as ExpoFSDeleteAsync,
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

import { defaultLogger } from '../logger/logger';
import platformEnv from '../platformEnv';

import bufferUtils from './bufferUtils';
import { getImageEmbedBridge } from './imageUtils.embedBridge';

import type { ReadingOptions } from 'expo-file-system/legacy';
import type {
  Action as ExpoImageManipulatorAction,
  ImageResult,
} from 'expo-image-manipulator';
import type { ImageSourcePropType } from 'react-native';

type ICommonImageLogFn = (...args: string[]) => void;

type ILocalImageUri = {
  base64Uri: string;
  nativeUri?: string; // only Native .file:/// path
  mimeType?: string;
  cleanup?: () => Promise<void>;
};

export type IPreparedImageForCrop = {
  uri: string;
  mimeType?: string;
  cleanup?: () => Promise<void>;
};

const range = (length: number) => [...Array(length).keys()];

export const toGrayScale = (red: number, green: number, blue: number): number =>
  Math.round(0.299 * red + 0.587 * green + 0.114 * blue);

// Dither images whose Otsu split falls below this confidence threshold.
const MIN_SEPARABILITY = 0.85;

// Noisy luminance can make color outliers look perfectly separable.
const FLAT_LUMINANCE_VARIANCE = 4;

type IProjection = (red: number, green: number, blue: number) => number;

const CHROMA_AXES: IProjection[] = [
  (red) => red,
  (_red, green) => green,
  (_red, _green, blue) => blue,
  (red, green) => Math.round((red - green + 255) / 2),
  (red, green, blue) => Math.round((blue - (red + green) / 2 + 255) / 2),
];

function projectPixels(data: Uint8ClampedArray, project: IProjection) {
  const pixelCount = data.length / 4;
  const values = new Uint8ClampedArray(pixelCount);
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    values[p] = project(data[i], data[i + 1], data[i + 2]);
    histogram[values[p]] += 1;
  }
  return { values, histogram, pixelCount };
}

// Returns the threshold axis, polarity, and whether the split is reliable.
export function pickThresholdAxis(data: Uint8ClampedArray) {
  const {
    values: luminance,
    histogram,
    pixelCount,
  } = projectPixels(data, toGrayScale);
  const brightness = otsuFromHistogram(histogram, pixelCount);
  const cut = (values: Uint8ClampedArray, threshold: number) => ({
    values,
    luminance,
    threshold,
    canSplit: true,
    aboveIsBrighter: isAboveThresholdBrighter(values, luminance, threshold),
  });

  if (brightness.separability >= MIN_SEPARABILITY) {
    return cut(luminance, brightness.threshold);
  }

  // Chroma can rescue equal-luminance colors only when luminance is flat.
  if (brightness.variance < FLAT_LUMINANCE_VARIANCE) {
    for (const project of CHROMA_AXES) {
      const projected = projectPixels(data, project);
      const chroma = otsuFromHistogram(projected.histogram, pixelCount);
      if (chroma.separability >= MIN_SEPARABILITY) {
        return cut(projected.values, chroma.threshold);
      }
    }
  }

  return {
    values: luminance,
    luminance,
    threshold: 128,
    canSplit: false,
    aboveIsBrighter: true,
  };
}

// Atkinson's 6/8 error diffusion preserves contrast on small screens.
export function atkinsonDither(
  luminance: Uint8ClampedArray,
  width: number,
): Uint8Array {
  const height = Math.floor(luminance.length / width);
  const error = new Float32Array(luminance.length);
  const out = new Uint8Array(luminance.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const value = luminance[i] + error[i];
      const black = value < 128;
      out[i] = black ? 0 : 255;
      const diffused = (value - (black ? 0 : 255)) / 8;

      const spread = (dx: number, dy: number) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny >= height) {
          return;
        }
        error[ny * width + nx] += diffused;
      };
      spread(1, 0);
      spread(2, 0);
      spread(-1, 1);
      spread(0, 1);
      spread(1, 1);
      spread(0, 2);
    }
  }
  return out;
}

// Derive polarity from cluster means because projection direction may differ.
function isAboveThresholdBrighter(
  values: Uint8ClampedArray,
  luminance: Uint8ClampedArray,
  threshold: number,
): boolean {
  let sumAbove = 0;
  let sumBelow = 0;
  let countAbove = 0;
  for (let p = 0; p < values.length; p += 1) {
    if (values[p] > threshold) {
      sumAbove += luminance[p];
      countAbove += 1;
    } else {
      sumBelow += luminance[p];
    }
  }
  const countBelow = values.length - countAbove;
  if (countAbove === 0 || countBelow === 0) {
    return true;
  }
  return sumAbove / countAbove >= sumBelow / countBelow;
}

// Only invert when white is unambiguously the majority; near 50% the Otsu
// threshold tracks the image's own median, so the ratio is noise-sensitive.
const INVERT_DEAD_ZONE = 0.05;

// Finds Otsu's threshold and its share of total variance.
export function otsuFromHistogram(histogram: number[], total: number) {
  let sum = 0;
  for (let t = 0; t < 256; t += 1) sum += t * histogram[t];

  const mean = total === 0 ? 0 : sum / total;
  let totalVariance = 0;
  for (let t = 0; t < 256; t += 1) {
    totalVariance += histogram[t] * (t - mean) * (t - mean);
  }
  totalVariance = total === 0 ? 0 : totalVariance / total;

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t += 1) {
    weightBackground += histogram[t];
    if (weightBackground !== 0) {
      const weightForeground = total - weightBackground;
      if (weightForeground === 0) break;

      sumBackground += t * histogram[t];
      const meanBackground = sumBackground / weightBackground;
      const meanForeground = (sum - sumBackground) / weightForeground;
      const betweenClassVariance =
        (weightBackground / total) *
        (weightForeground / total) *
        (meanBackground - meanForeground) *
        (meanBackground - meanForeground);
      if (betweenClassVariance > maxVariance) {
        maxVariance = betweenClassVariance;
        threshold = t;
      }
    }
  }

  return {
    threshold,
    separability: totalVariance === 0 ? 0 : maxVariance / totalVariance,
    variance: totalVariance,
  };
}

// Reverse only when white is unambiguously the majority. Near 50% the Otsu
// threshold tracks the image's own median, making the ratio noise-sensitive.
export function shouldInvertForMajorityWhite(
  whiteCount: number,
  pixelCount: number,
): boolean {
  return whiteCount > pixelCount * (0.5 + INVERT_DEAD_ZONE);
}

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
  return base64Uri.replace(/^data:[^,]*;base64,/, '');
}

function convertToBlackAndWhiteImageBase64(
  colorImageBase64: string,
  mime: string,
): Promise<string> {
  if (platformEnv.isNative) {
    return getImageEmbedBridge().convertToBlackAndWhiteImageBase64(
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
      const pixelCount = data.length / 4;

      // Prefer luminance, using chroma only for equal-luminance colors.
      const { values, luminance, threshold, canSplit, aboveIsBrighter } =
        pickThresholdAxis(data);

      // Dither continuous tones instead of producing a blank bitmap.
      if (!canSplit) {
        const dithered = atkinsonDither(luminance, canvas.width);
        for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
          data[i] = dithered[p];
          data[i + 1] = dithered[p];
          data[i + 2] = dithered[p];
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL(mime || 'image/jpeg'));
        return;
      }

      let whiteCount = 0;
      for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
        const isAbove = values[p] > threshold;
        const isWhite = isAbove === aboveIsBrighter;
        const bw = isWhite ? 255 : 0;
        if (bw === 255) {
          whiteCount += 1;
        }
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
      }

      if (shouldInvertForMajorityWhite(whiteCount, pixelCount)) {
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
  if (ctx === null || ctx === undefined) {
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
    return getImageEmbedBridge().applyRoundedCorners({
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
  includeHex?: boolean;
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
    includeHex = true,
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

  const hex = includeHex
    ? bufferUtils.bytesToHex(Buffer.from(imageResult.base64 ?? '', 'base64'))
    : '';
  return { ...imageResult, hex };
}

function readBase64Bytes(base64: string, offset: number, length: number) {
  const base64Start = Math.floor(offset / 3) * 4;
  const byteOffset = offset - Math.floor(offset / 3) * 3;
  const base64Length = Math.ceil((byteOffset + length) / 3) * 4;
  return Buffer.from(
    base64.substring(base64Start, base64Start + base64Length),
    'base64',
  ).subarray(byteOffset, byteOffset + length);
}

function detectPngMimeType(
  base64: string,
  assumeStaticWhenIncomplete: boolean,
): 'image/apng' | 'image/png' | null {
  let paddingLength = 0;
  if (base64.endsWith('==')) {
    paddingLength = 2;
  } else if (base64.endsWith('=')) {
    paddingLength = 1;
  }
  const byteLength = Math.floor((base64.length * 3) / 4) - paddingLength;
  let offset = 8;

  while (offset + 12 <= byteLength) {
    const chunkHeader = readBase64Bytes(base64, offset, 8);
    if (chunkHeader.length < 8) {
      return assumeStaticWhenIncomplete ? 'image/png' : null;
    }

    const dataLength = chunkHeader.readUInt32BE(0);
    const chunkType = chunkHeader.toString('ascii', 4, 8);
    if (chunkType === 'acTL') return 'image/apng';
    if (chunkType === 'IDAT' || chunkType === 'IEND') return 'image/png';

    const nextOffset = offset + 12 + dataLength;
    if (nextOffset <= offset || nextOffset > byteLength) {
      return assumeStaticWhenIncomplete ? 'image/png' : null;
    }
    offset = nextOffset;
  }

  return assumeStaticWhenIncomplete ? 'image/png' : null;
}

/** Detect MIME type from file magic bytes and PNG chunk metadata. */
export function detectMimeTypeFromMagicBytes(base64: string): string | null {
  if (!base64) return null;

  // Get first few bytes from base64
  // 32 base64 chars = ~24 bytes, enough for most file signatures
  const bytes = base64.length > 32 ? base64.substring(0, 32) : base64;

  // Common file signatures (magic bytes)
  // JPEG: FF D8 FF
  if (bytes.startsWith('/9j/')) return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (bytes.startsWith('iVBORw0KGgo')) {
    return detectPngMimeType(base64, true);
  }
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

export function getImageMimeTypeFromBase64Uri(base64Uri: string) {
  const declaredMimeType = base64Uri.match(/^data:([^;,]+)/u)?.[1];
  const detectedMimeType = detectMimeTypeFromMagicBytes(
    stripBase64UriPrefix(base64Uri),
  );
  return detectedMimeType || declaredMimeType;
}

const IMAGE_MIME_PROBE_MAX_BYTES = 64 * 1024;

function normalizeMimeType(mimeType: string | null | undefined) {
  return mimeType?.split(';')[0].trim().toLowerCase() || undefined;
}

function detectMimeTypeFromProbeBytes(bytes: Uint8Array) {
  const base64 = Buffer.from(bytes).toString('base64');
  if (base64.startsWith('iVBORw0KGgo')) {
    return detectPngMimeType(base64, false);
  }
  return detectMimeTypeFromMagicBytes(base64);
}

async function readResponsePrefix(response: Response) {
  const reader = response.body?.getReader();
  if (reader) {
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    try {
      while (byteLength < IMAGE_MIME_PROBE_MAX_BYTES) {
        const result = await reader.read();
        if (result.done) break;
        const remaining = IMAGE_MIME_PROBE_MAX_BYTES - byteLength;
        const chunk = result.value.slice(0, remaining);
        chunks.push(chunk);
        byteLength += chunk.length;
        if (chunk.length < result.value.length) break;
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }

    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }

  const contentLengthHeader = response.headers.get('content-length');
  const contentLength = contentLengthHeader
    ? Number(contentLengthHeader)
    : Number.NaN;
  const isBoundedResponse =
    Number.isFinite(contentLength) &&
    contentLength <= IMAGE_MIME_PROBE_MAX_BYTES;
  if (!isBoundedResponse) return undefined;

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > IMAGE_MIME_PROBE_MAX_BYTES) return undefined;
  return new Uint8Array(buffer);
}

async function probeImageMimeTypeNative(uri: string, signal?: AbortSignal) {
  const headResponse = await fetch(uri, { method: 'HEAD', signal });
  const declaredMimeType = normalizeMimeType(
    headResponse.headers.get('content-type'),
  );
  const potentiallySupportedMimeTypes = [
    'application/octet-stream',
    'image/bmp',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ];
  if (
    declaredMimeType &&
    !potentiallySupportedMimeTypes.includes(declaredMimeType)
  ) {
    return declaredMimeType;
  }

  const contentLengthHeader = headResponse.headers.get('content-length');
  const contentLength = contentLengthHeader
    ? Number(contentLengthHeader)
    : Number.NaN;
  const acceptsRanges = headResponse.headers
    .get('accept-ranges')
    ?.toLowerCase()
    .includes('bytes');
  const hasBoundedContentLength =
    Number.isFinite(contentLength) &&
    contentLength <= IMAGE_MIME_PROBE_MAX_BYTES;
  if (!acceptsRanges && !hasBoundedContentLength) return undefined;
  if (signal?.aborted) return undefined;

  const cacheDir = await getNativeCacheDirectory();
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10_000);
  const savedPath = `${cacheDir}temp-image-probe-${timestamp}-${random}`;
  const cleanup = createNativeCacheCleanup(savedPath);
  try {
    const result = await ExpoFSDownloadAsync(uri, savedPath, {
      headers: {
        Range: `bytes=0-${IMAGE_MIME_PROBE_MAX_BYTES - 1}`,
      },
    });
    if (signal?.aborted) return undefined;

    const base64 = await ExpoFSReadAsStringAsync(result.uri, {
      encoding: 'base64',
      length: IMAGE_MIME_PROBE_MAX_BYTES,
      position: 0,
    });
    return (
      detectMimeTypeFromProbeBytes(Buffer.from(base64, 'base64')) || undefined
    );
  } finally {
    await cleanup();
  }
}

/**
 * Probe only the leading bytes needed for media-type detection. Native uses a
 * file-backed range request; stream-capable platforms cancel after the bounded
 * prefix, so NFT details never preload the full asset into JavaScript memory.
 */
export async function probeImageMimeType(uri: string, signal?: AbortSignal) {
  if (isBase64Uri(uri)) {
    return getImageMimeTypeFromBase64Uri(uri);
  }

  if (platformEnv.isNative) {
    try {
      return await probeImageMimeTypeNative(uri, signal);
    } catch {
      return undefined;
    }
  }

  const controller = signal ? undefined : new AbortController();
  try {
    const response = await fetch(uri, {
      headers: {
        Range: `bytes=0-${IMAGE_MIME_PROBE_MAX_BYTES - 1}`,
      },
      signal: signal ?? controller?.signal,
    });
    const bytes = await readResponsePrefix(response);
    if (!bytes?.length) return undefined;

    const detectedMimeType = detectMimeTypeFromProbeBytes(bytes);
    const hasPngSignature =
      bytes.length >= 8 &&
      bytes[0] === 137 &&
      bytes[1] === 80 &&
      bytes[2] === 78 &&
      bytes[3] === 71 &&
      bytes[4] === 13 &&
      bytes[5] === 10 &&
      bytes[6] === 26 &&
      bytes[7] === 10;
    if (hasPngSignature) return detectedMimeType || undefined;
    return detectedMimeType || undefined;
  } catch {
    return undefined;
  } finally {
    controller?.abort();
  }
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
  nativeModuleId,
  uri,
  logFn,
}: {
  nativeModuleId?: number;
  uri: string;
  logFn?: ICommonImageLogFn;
}) {
  const errors: string[] = [];
  let base64a: string | undefined;
  let base64b: string | undefined;
  let base64c: string | undefined;
  let base64d: string | undefined;

  // **** use expo-file-system
  try {
    base64a = await readAsStringAsync(nativeModuleId ?? uri, {
      encoding: 'base64',
    });
  } catch (error) {
    errors.push(
      'ExpoFSReadAsStringAsync error',
      (error as Error)?.message || '',
    );
  }

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
  logFn?.('getRNLocalImageBase64 uris', uri, uri2 || '');
  logFn?.(
    'getRNLocalImageBase64 base64',
    base64a || '',
    base64b || '',
    base64c || '',
    base64d || '',
  );

  const base64 = base64a || base64b || base64c || base64d;
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
  cleanup?: () => Promise<void>;
}> {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10_000);
  const fileName = `temp-image-crop-${timestamp}-${random}.${ext}`;

  const cacheDir = await getNativeCacheDirectory();
  const savedPath = `${cacheDir}${fileName}`;

  let newUri = uri;
  let mimetype;
  let cleanup: (() => Promise<void>) | undefined;
  if (isHttpUri(uri)) {
    logFn?.('(native) download remote image', savedPath, uri);

    cleanup = createNativeCacheCleanup(savedPath);
    try {
      // eslint-disable-next-line no-param-reassign
      const result = await ExpoFSDownloadAsync(uri, savedPath);
      mimetype = result.headers?.['content-type'];
      newUri = result.uri;
    } catch (error) {
      await cleanup();
      throw error;
    }
    logFn?.('(native) download to local uri', uri);
  } else if (isBase64Uri(uri)) {
    cleanup = createNativeCacheCleanup(savedPath);
    try {
      newUri = await nativeSaveBase64ToCache({ uri, savedPath, logFn });
    } catch (error) {
      await cleanup();
      throw error;
    }
  }

  return { uri: newUri, mimetype, cleanup };
}

function createNativeCacheCleanup(uri: string) {
  let cleaned = false;
  return async () => {
    if (cleaned) return;
    cleaned = true;
    try {
      await ExpoFSDeleteAsync(uri, { idempotent: true });
    } catch {
      // Cleanup is best-effort and must not replace the original result.
    }
  };
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
  let cleanup: (() => Promise<void>) | undefined;
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
      cleanup = res.cleanup;
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
      detectedMimeType ||
      downloadMimeType?.split(';')[0] ||
      formatInfo.mimeType;

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
      mimeType: finalMimeType,
      cleanup,
    };
  } catch (error) {
    await cleanup?.();
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

      // oxlint-disable-next-line @cspell/spellchecker
      reader.onloadend = async () => {
        let readerResult = reader.result as string;

        if (readerResult.includes('image/svg+xml;base64')) {
          readerResult = await convertSvgToJpegBase64(readerResult);
        }

        const mimeType = getImageMimeTypeFromBase64Uri(readerResult);
        // readerResult is base64 string with mime prefix
        resolve({ base64Uri: readerResult, mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (_error) {
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
    return {
      base64Uri: uri,
      mimeType: getImageMimeTypeFromBase64Uri(uri),
    };
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
  } catch (_error) {
    // ignore
  }

  if (platformEnv.isNative && !isNil(source) && !isString(source)) {
    if (isNumber(source)) {
      try {
        logFn?.('(native) ImageSource number', source.toString());
      } catch (_error) {
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

let androidBundledResourceCopySequence = 0;

/**
 * Read a URI or a React Native `require()` asset as a string.
 *
 * Android release bundles resolve `require()` assets to drawable resource
 * identifiers without a URI scheme. Expo FileSystem can copy those resources,
 * but its Base64 reader only accepts URI-backed input streams.
 */
export async function readAsStringAsync(
  source: ImageSourcePropType | string,
  options?: ReadingOptions,
): Promise<string> {
  const uri = await getUriFromRequiredImageSource(source);
  if (!uri) {
    throw new OneKeyLocalError('Failed to resolve file source');
  }

  // `require('./image.png')` returns a numeric Metro asset ID on React
  // Native. In Android release builds, `resolveAssetSource()` maps that ID to
  // a compiled drawable resource name without a URI scheme. There is no full
  // path to construct because the image lives in the APK resource table.
  //
  // expo-file-system's legacy Android implementation already handles such
  // resource names for non-Base64 reads through `openResourceInputStream`.
  // Its Base64 branch instead uses `getInputStream`, which rejects a null
  // scheme. Detect that known limitation before calling into native code so
  // an expected exception is not used as normal control flow. Requiring a
  // numeric source also prevents arbitrary scheme-less paths from being
  // mistaken for packaged drawable resources.
  const shouldCopyAndroidBundledResource =
    platformEnv.isNativeAndroid &&
    isNumber(source) &&
    !uri.includes(':') &&
    options?.encoding === 'base64';

  if (!shouldCopyAndroidBundledResource) {
    return ExpoFSReadAsStringAsync(uri, options);
  }

  const cacheDir = await getNativeCacheDirectory();
  androidBundledResourceCopySequence += 1;
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  // The sequence makes concurrent calls unique within one JS runtime, even if
  // their timestamp and random value happen to match. Android main and bg use
  // isolated JS runtimes, so their counters are not shared; the timestamp and
  // wide random component make collisions across those runtimes negligible.
  // This matters because both runtimes share the native cache directory: a
  // collision could let one call overwrite or delete another call's file.
  const copiedUri = `${cacheDir}bundled-resource-${source}-${timestamp}-${random}-${androidBundledResourceCopySequence}`;

  try {
    // Materialize the APK drawable as a regular file URI, which the Base64
    // reader can consume without needing to understand Android resources.
    await ExpoFSCopyAsync({ from: uri, to: copiedUri });
    return await ExpoFSReadAsStringAsync(copiedUri, options);
  } finally {
    try {
      await ExpoFSDeleteAsync(copiedUri, { idempotent: true });
    } catch {
      // Cleanup is best-effort: a deletion failure must not replace either a
      // successful read result or the original copy/read error.
    }
  }
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

  try {
    if (!imageUri?.base64Uri) {
      return undefined;
    }
    return imageUri.base64Uri;
  } finally {
    await imageUri?.cleanup?.();
  }
}

async function prepareImageForCropWithInfo(
  source: ImageSourcePropType | string | undefined,
  logFn?: ICommonImageLogFn,
): Promise<IPreparedImageForCrop> {
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
    if (!imageUri.nativeUri) {
      throw new OneKeyLocalError('Failed to prepare native image source');
    }
    return {
      uri: imageUri.nativeUri,
      mimeType: imageUri.mimeType,
      cleanup: imageUri.cleanup,
    };
  }

  return { uri: imageUri.base64Uri, mimeType: imageUri.mimeType };
}

async function prepareImageForCrop(
  source: ImageSourcePropType | string | undefined,
  logFn?: ICommonImageLogFn,
): Promise<string | undefined> {
  const preparedImage = await prepareImageForCropWithInfo(source, logFn);
  return preparedImage.uri;
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
    return getImageEmbedBridge().base64ImageToBitmap({
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
    return getImageEmbedBridge().processImageBlur({
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
  readAsStringAsync,
  getBase64FromRequiredImageSource,
  getBase64FromImageUri,
  base64ImageToBitmap,
  buildHtmlImage,
  getBase64ImageFromUrl,
  applyRoundedCorners,
  prepareImageForCrop,
  prepareImageForCropWithInfo,
  probeImageMimeType,
  base64ImageToBlob,
};
