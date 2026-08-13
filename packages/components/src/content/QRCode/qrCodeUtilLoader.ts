import QRCodeUtil from 'qrcode';

// Web-family targets ship the encoder statically: their startup budgets
// absorb it, an extra async chunk is exactly what the extension build's
// file-count budget meters, and a statically bundled module cannot fail to
// load at runtime. Only native needs the async edge, to keep the library
// out of the startup graph — see ./qrCodeUtilLoader.native.ts.
export function ensureQRCodeUtilLoaded(): Promise<void> {
  return Promise.resolve();
}

export function isQRCodeUtilLoaded(): boolean {
  return true;
}

export function getQRCodeUtil(): typeof QRCodeUtil {
  return QRCodeUtil;
}
