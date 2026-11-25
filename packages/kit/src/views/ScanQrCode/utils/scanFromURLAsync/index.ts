import { decodeQrImage } from '@onekeyfe/react-native-qr-scanner';

/**
 * Raw text of the QR code in a picked image, or `null` when the image has
 * none or cannot be read. The SDK corrects EXIF orientation and retries with
 * a quiet zone, grayscale and inverted passes (codes in screenshots often
 * have no margin; see OK-67798).
 */
export async function scanFromURLAsync(uri: string): Promise<string | null> {
  try {
    return await decodeQrImage(uri);
  } catch (error) {
    console.error('scanFromURLAsync error: ', error);
    return null;
  }
}
