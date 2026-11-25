// cspell:ignore zxing emscripten
import { configureWebQrScanner } from '@onekeyfe/react-native-qr-scanner/web';
import zxingReaderWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

function readWasmBinary(assetUrl: string): Promise<ArrayBuffer> {
  // Asset URLs are root-relative ("/static/..."); resolve them against the
  // page so the desktop renderer's file:// scheme is visible below.
  const url = globalThis.location
    ? new URL(assetUrl, globalThis.location.href).href
    : assetUrl;
  // Desktop renders from file://, which fetch() cannot read; use XHR there.
  if (url.startsWith('file:')) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('GET', url);
      request.responseType = 'arraybuffer';
      request.onload = () => {
        if (
          request.status === 200 ||
          (request.status === 0 && request.response)
        ) {
          resolve(request.response as ArrayBuffer);
        } else {
          reject(
            new OneKeyLocalError(`Failed to load ${url}: ${request.status}`),
          );
        }
      };
      request.onerror = () =>
        reject(new OneKeyLocalError(`Failed to load ${url}`));
      request.send();
    });
  }
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new OneKeyLocalError(`Failed to load ${url}: ${response.status}`);
    }
    return response.arrayBuffer();
  });
}

let configured = false;

/**
 * Points the scanner SDK's zxing fallback (used where the browser has no
 * QR-capable BarcodeDetector: Chromium on Windows/Linux, Firefox, Safari) at
 * the wasm bundled with the app. The SDK never downloads it, and nothing is
 * fetched until the fallback is first needed.
 */
export function ensureWebQrScannerConfigured() {
  if (configured) return;
  configured = true;
  configureWebQrScanner({
    loadZXingWasm: () => readWasmBinary(zxingReaderWasmUrl),
  });
}
