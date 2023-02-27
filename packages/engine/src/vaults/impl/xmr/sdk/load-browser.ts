import instantiate from './monero-core';
import wasmBinaryFileName from './monero-core.wasm.bin';

import type MoneroCoreInstance from './moneroCoreInstance';

const locateFile = (file: string, _scriptDir: string) => {
  if (file !== 'monero-core.wasm') {
    console.error('Unexpected file:', file);
  }
  return wasmBinaryFileName;
};

export const loadWasmInstance = async (
  importObj: any,
): Promise<MoneroCoreInstance | null> => {
  importObj['locateFile'] = locateFile;
  return instantiate(importObj);
};
