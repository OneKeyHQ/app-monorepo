import {
  DEFAULT_MAX_IMAGE_PIXELS,
  decodeQrImage,
} from '@onekeyfe/react-native-qr-scanner/web';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ensureWebQrScannerConfigured } from '../../components/ScanCamera/webQrScanner';

// The web photo picker returns a data URL. Decode it here rather than with
// fetch(), which the extension's CSP does not allow for data: URLs.
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) {
    throw new OneKeyLocalError('Unsupported image URL');
  }
  const [, mimeType, base64, payload] = match;
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

// SVGs require the browser's image-element renderer. Keep uploaded SVG
// content in image context and bound the raster size before allocating it.
async function decodeSvg(dataUrl: string): Promise<string | null> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!width || !height) throw new OneKeyLocalError('Invalid SVG dimensions');
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
        else reject(new OneKeyLocalError('Could not rasterize SVG'));
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
    const blob = dataUrlToBlob(dataUrl);
    return await (blob.type === 'image/svg+xml'
      ? decodeSvg(dataUrl)
      : decodeQrImage(blob));
  } catch (error) {
    console.error('scanFromURLAsync error: ', error);
    return null;
  }
}
