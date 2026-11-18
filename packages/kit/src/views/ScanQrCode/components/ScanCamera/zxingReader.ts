// cspell:ignore zxing emscripten
import zxingReaderWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// Declared here because barcode-detector types its overrides with the global
// EmscriptenModule interface, which this repo does not load.
type IInstantiateWasm = (
  imports: WebAssembly.Imports,
  receiveInstance: (instance: WebAssembly.Instance) => void,
) => WebAssembly.Exports | undefined;

let preparing: Promise<void> | undefined;
let prepared = false;

function hasNativeBarcodeDetector() {
  return 'BarcodeDetector' in globalThis;
}

function readWasmBinary(assetUrl: string): Promise<ArrayBuffer> {
  // Asset URLs are root-relative ("/static/..."); resolve them against the
  // page so the desktop renderer's file:// scheme is visible below.
  const url = globalThis.location
    ? new URL(assetUrl, globalThis.location.href).href
    : assetUrl;
  // Desktop renders from file://, which fetch() cannot read, and the
  // emscripten loader in zxing-wasm only uses fetch; load it through XHR.
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

const instantiateBundledWasm: IInstantiateWasm = (imports, receiveInstance) => {
  void readWasmBinary(zxingReaderWasmUrl)
    .then((binary) => WebAssembly.instantiate(binary, imports))
    .then(({ instance }) => receiveInstance(instance))
    .catch((error: unknown) => {
      console.error('[ScanCamera] Failed to load zxing reader', error);
    });
  return undefined;
};

export function isZXingReaderPrepared() {
  return prepared || hasNativeBarcodeDetector();
}

// Without a native BarcodeDetector (Chromium on Windows/Linux, Firefox),
// expo-camera decodes through the barcode-detector polyfill, which downloads
// its zxing wasm from jsDelivr by default and instantiates it unverified.
// This hands the polyfill the copy bundled with the app instead. It must run
// before the first scan, so ScanCamera mounts CameraView only once it resolves.
export function prepareZXingReader(): Promise<void> {
  if (isZXingReaderPrepared()) {
    return Promise.resolve();
  }
  preparing ??= import('barcode-detector/ponyfill')
    .then(({ setZXingModuleOverrides }) => {
      setZXingModuleOverrides({ instantiateWasm: instantiateBundledWasm });
      prepared = true;
    })
    .catch((error: unknown) => {
      preparing = undefined;
      throw error;
    });
  return preparing;
}
