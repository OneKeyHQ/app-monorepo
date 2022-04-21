import { useWorker } from '@koale/useworker';
import { BarCodeScanningResult } from 'expo-camera';

import { captureImageData } from './WebCameraUtils';

let worker: Worker;



export function scanQrcodeInImage(image) {
  if (!worker) {
    worker = new Worker('https://cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js')
    worker.onerror((event) =>{
      console.log([
        'ERROR: Line ', e.lineno, ' in ', e.filename, ': ', e.message
      ].join(''));
    });
  }
}
const qrWorkerMethod = ({ data, width, height }: ImageData): any => {
  // eslint-disable-next-line no-undef
  const decoded = (self as any).jsQR(data, width, height, {
    inversionAttempts: 'dontInvert',
  });

  let parsed;
  try {
    parsed = JSON.parse(decoded);
  } catch (err) {
    parsed = decoded;
  }

  if (parsed?.data) {
    const nativeEvent: BarCodeScanningResult = {
      type: 'qr',
      data: parsed.data,
    };
    if (parsed.location) {
      nativeEvent.cornerPoints = [
        parsed.location.topLeftCorner,
        parsed.location.bottomLeftCorner,
        parsed.location.topRightCorner,
        parsed.location.bottomRightCorner,
      ];
    }
    return nativeEvent;
  }
  return parsed;
};


export async function scanQrcodeInImage() {
  try {
    const data = captureImageData(video.current, captureOptions);

    if (data) {
      const nativeEvent: BarCodeScanningResult | any = await decode(data);
      if (nativeEvent?.data) {
        onScanned({
          nativeEvent,
        });
      }
    }
  } catch (error) {
    if (onError) {
      onError({ nativeEvent: error });
    }
  }
}
