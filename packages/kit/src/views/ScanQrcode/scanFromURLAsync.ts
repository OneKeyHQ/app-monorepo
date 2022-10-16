import { BarCodeScanner } from 'expo-barcode-scanner';

// TODO scan qrcode from base64 string
//    https://gist.github.com/aibrahim3546/7a3c7405c0a090889774ee29b1d87db7
export async function scanFromURLAsync(url: string) {
  try {
    const [result] = await BarCodeScanner.scanFromURLAsync(url);
    return result.data;
  } catch (e) {
    console.error(`scanFromURLAsync(${url}) error: `, e);
    return null;
  }
}
