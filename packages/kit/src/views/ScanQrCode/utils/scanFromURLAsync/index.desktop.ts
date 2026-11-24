import { maxDesktopQrImageBytes } from '@onekeyhq/shared/types/desktopQrScanner';

import { dataUrlToBlob, scanFromURLAsync as scanFromWeb } from './index.web';

export async function scanFromURLAsync(
  dataUrl: string,
): Promise<string | null> {
  const scanner = globalThis.desktopApi?.qrScanner;
  if (scanner) {
    try {
      const image = dataUrlToBlob(dataUrl);
      if (
        image.type !== 'image/svg+xml' &&
        image.size <= maxDesktopQrImageBytes
      ) {
        const result = await scanner.decodeImage(
          new Uint8Array(await image.arrayBuffer()),
        );
        if (result !== null) return result;
      }
    } catch {
      // The desktop decoder can decline images that Chromium can still read.
    }
  }
  return scanFromWeb(dataUrl);
}
