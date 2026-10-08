// cspell:ignore zxing
import { prepareZXingReader } from '../../components/ScanCamera/zxingReader';

import type { BarcodeDetector as IBarcodeDetectorPonyfill } from 'barcode-detector/ponyfill';

type IBarcodeDetectorClass = typeof IBarcodeDetectorPonyfill;

async function getImageData(dataUrl: string): Promise<ImageData> {
  return new Promise((resolve) => {
    const img = new Image();

    img.crossOrigin = 'anonymous';

    img.onload = function () {
      const width = img.width || img.naturalWidth || 150;
      const height = img.height || img.naturalHeight || 150;
      const actualWidth = Math.min(960, width);
      const actualHeight = height * (actualWidth / width);

      const canvas = document.createElement('canvas');
      canvas.width = actualWidth;
      canvas.height = actualHeight;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const context = canvas.getContext('2d')!;
      context.drawImage(
        img,
        0,
        0,
        width,
        height,
        0,
        0,
        actualWidth,
        actualHeight,
      );

      resolve(context.getImageData(0, 0, actualWidth, actualHeight));
    };

    img.src = dataUrl;
  });
}

async function getBarcodeDetectorClass(): Promise<IBarcodeDetectorClass> {
  const { BarcodeDetector: NativeBarcodeDetector } = globalThis as {
    BarcodeDetector?: IBarcodeDetectorClass;
  };
  if (NativeBarcodeDetector) {
    return NativeBarcodeDetector;
  }
  // Same bundled zxing reader as the camera scanner (see zxingReader.ts).
  await prepareZXingReader();
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  return BarcodeDetector;
}

export async function decodeQrImageData(
  imageData: ImageData,
): Promise<string | null> {
  const BarcodeDetector = await getBarcodeDetectorClass();
  const [barcode] = await new BarcodeDetector({ formats: ['qr_code'] }).detect(
    imageData,
  );
  return barcode?.rawValue ?? null;
}

export async function scanFromURLAsync(base64Url: string) {
  return decodeQrImageData(await getImageData(base64Url));
}
