import { BarCodeScanner } from 'expo-barcode-scanner';

export async function scanFromURLAsync(url: string) {
  try {
    const [result] = await BarCodeScanner.scanFromURLAsync(url, [
      BarCodeScanner.Constants.BarCodeType.qr,
    ]);
    return result;
  } catch (e) {
    console.error(`scanFromURLAsync(${url}) error: `, e);
    return null;
  }
}
