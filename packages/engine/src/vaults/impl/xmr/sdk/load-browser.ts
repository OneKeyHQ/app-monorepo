/**
 * Webpack trys to parse .wasm file even if file-loader is used. Using extension
 * *.wasm.bin as a workaround.
 * See https://github.com/webpack/webpack/issues/6725.
 * To facilitate streaming compilation by the browser, *.wasm.bin files
 * should be served as MIME type 'application/wasm'.
 */
// import wasmBinaryFile from './zbar.wasm';
import wasmBinaryFileName from './monero-core.wasm.bin';
import instantiate from './monero-core';

// locateFile is used to override the file path to the path provided by
// file-loader.
const locateFile = (file: string, _scriptDir: string) => {
  if (file !== 'monero-core.wasm') {
    console.error('Unexpected file:', file);
  }
  return wasmBinaryFileName;
};

export const loadWasmInstance = async (
  importObj: any,
): Promise<ZBarInstance | null> => {
  importObj['locateFile'] = locateFile;
  return await instantiate(importObj);
};
