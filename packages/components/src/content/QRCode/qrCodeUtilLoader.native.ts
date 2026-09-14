import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type QRCodeUtilType from 'qrcode';

type IQRCodeUtil = typeof QRCodeUtilType;

// The encoder is ~70KB across 27 modules, and the QRCode component is
// reachable from the native startup graph through the components barrel.
// Loading the library behind an async edge keeps it out of the startup
// bundle; render paths gate on ensureQRCodeUtilLoaded() before calling the
// sync helpers. Web-family targets bundle it statically instead — see
// ./qrCodeUtilLoader.ts.
let loadedQRCodeUtil: IQRCodeUtil | undefined;
let qrCodeUtilPromise: Promise<void> | undefined;

export function ensureQRCodeUtilLoaded(): Promise<void> {
  if (!qrCodeUtilPromise) {
    qrCodeUtilPromise = import('qrcode').then(
      (mod) => {
        // CJS/ESM interop shape differs across metro and jest
        loadedQRCodeUtil = (mod.default ?? mod) as IQRCodeUtil;
      },
      (error) => {
        // a segment load can fail transiently; drop the failed attempt so
        // the next caller retries instead of replaying a cached rejection
        qrCodeUtilPromise = undefined;
        throw error;
      },
    );
  }
  return qrCodeUtilPromise;
}

export function isQRCodeUtilLoaded(): boolean {
  return Boolean(loadedQRCodeUtil);
}

export function getQRCodeUtil(): IQRCodeUtil {
  if (!loadedQRCodeUtil) {
    throw new OneKeyLocalError(
      'QRCode encoder not loaded: await ensureQRCodeUtilLoaded() first',
    );
  }
  return loadedQRCodeUtil;
}
