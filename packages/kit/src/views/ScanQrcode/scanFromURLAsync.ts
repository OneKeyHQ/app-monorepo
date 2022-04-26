import { BarCodeScanner } from 'expo-barcode-scanner';

export async function scanFromURLAsync(url: string) {
  try {
    const [result] = await BarCodeScanner.scanFromURLAsync(url);
    return result.data;
  } catch (e) {
    console.error(`scanFromURLAsync(${url}) error: `, e);
    return null;
  }
}
