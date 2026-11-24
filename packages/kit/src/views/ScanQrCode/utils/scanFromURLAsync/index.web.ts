import { decodeQrImage } from '@onekeyfe/react-native-qr-scanner/web';

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

export async function scanFromURLAsync(
  dataUrl: string,
): Promise<string | null> {
  ensureWebQrScannerConfigured();
  try {
    return await decodeQrImage(dataUrlToBlob(dataUrl));
  } catch (error) {
    console.error('scanFromURLAsync error: ', error);
    return null;
  }
}
