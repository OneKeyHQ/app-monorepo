import {
  DEFAULT_MAX_IMAGE_PIXELS,
  decodeQrImage,
} from '@onekeyfe/react-native-qr-scanner/web';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ensureWebQrScannerConfigured } from '../../components/ScanCamera/webQrScanner';

import { isAvifWithinPixelBudget } from './avifSource';

function parseDataUrl(dataUrl: string) {
  const comma = dataUrl.indexOf(',');
  const match =
    comma < 0
      ? null
      : /^data:([^;,]*)(;base64)?$/.exec(dataUrl.slice(0, comma));
  if (!match) {
    throw new OneKeyLocalError('Unsupported image URL');
  }
  const [, mimeType, base64] = match;
  return {
    mimeType: mimeType.toLowerCase(),
    base64,
    payload: dataUrl.slice(comma + 1),
  };
}

// The extension's CSP does not allow fetching data: URLs.
function imageDataToBlob({
  mimeType,
  base64,
  payload,
}: ReturnType<typeof parseDataUrl>): Blob {
  if (!base64) {
    return new Blob([decodeURIComponent(payload)], { type: mimeType });
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  return imageDataToBlob(parseDataUrl(dataUrl));
}

// Keep SVGs in image context and use the browser's AVIF decoder before
// handing a bounded PNG to the QR SDK.
async function decodeImageElement(dataUrl: string): Promise<string | null> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!width || !height) throw new OneKeyLocalError('Invalid image dimensions');
  const scale = Math.min(
    1,
    4096 / Math.max(width, height),
    Math.sqrt(DEFAULT_MAX_IMAGE_PIXELS / (width * height)),
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new OneKeyLocalError('Canvas is unavailable');
  const decodeOnBackground = async (background: string) => {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const raster = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((png) => {
        if (png) resolve(png);
        else reject(new OneKeyLocalError('Could not rasterize image'));
      }, 'image/png');
    });
    return decodeQrImage(raster);
  };

  const result = await decodeOnBackground('#fff');
  return result ?? (await decodeOnBackground('#000'));
}

export async function scanFromURLAsync(
  dataUrl: string,
): Promise<string | null> {
  ensureWebQrScannerConfigured();
  try {
    const image = parseDataUrl(dataUrl);
    if (
      image.mimeType === 'image/avif' &&
      (!image.base64 ||
        !isAvifWithinPixelBudget(image.payload, DEFAULT_MAX_IMAGE_PIXELS))
    ) {
      return null;
    }
    return await (image.mimeType === 'image/svg+xml' ||
    image.mimeType === 'image/avif'
      ? decodeImageElement(dataUrl)
      : decodeQrImage(imageDataToBlob(image)));
  } catch (error) {
    console.error('scanFromURLAsync error: ', error);
    return null;
  }
}
