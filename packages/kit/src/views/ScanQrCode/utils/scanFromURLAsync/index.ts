import * as qrScanner from '@onekeyfe/react-native-qr-scanner';

import type { IMultiQrImageResult } from '../multiQrSymbols';

type INativeImageSymbolsDecoder = {
  decodeQrImageSymbols?: (uri: string) => Promise<IMultiQrImageResult>;
};

/**
 * Raw text of the QR code in a picked image, or `null` when the image has
 * none or cannot be read. The SDK corrects EXIF orientation and retries with
 * a quiet zone, grayscale and inverted passes (codes in screenshots often
 * have no margin; see OK-67798).
 */
export async function scanFromURLAsync(uri: string): Promise<string | null> {
  try {
    return await qrScanner.decodeQrImage(uri);
  } catch (error) {
    console.error('scanFromURLAsync error: ', error);
    return null;
  }
}

/**
 * Decodes all QR symbols in a picked image with normalized top-left
 * coordinates in EXIF-oriented image space. Falls back to single-symbol
 * `decodeQrImage` when running against an older SDK build.
 */
export async function scanSymbolsFromURLAsync(
  uri: string,
): Promise<IMultiQrImageResult> {
  try {
    const decoder = (qrScanner as INativeImageSymbolsDecoder)
      .decodeQrImageSymbols;
    if (typeof decoder === 'function') {
      return await decoder(uri);
    }
    const text = await qrScanner.decodeQrImage(uri);
    return {
      width: 0,
      height: 0,
      symbols: text ? [{ text, centerX: 0.5, centerY: 0.5 }] : [],
    };
  } catch (error) {
    console.error('scanSymbolsFromURLAsync error: ', error);
    return { width: 0, height: 0, symbols: [] };
  }
}
