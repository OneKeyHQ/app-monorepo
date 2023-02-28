/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import instantiate from './monero-core';
import wasmBinaryFileName from './monero-core.wasm.bin';

import type { MoneroCoreInstance } from './moneroTypes';

const locateFile = (file: string) => {
  if (file !== 'monero-core.wasm') {
    console.error('Unexpected file:', file);
  }
  return wasmBinaryFileName;
};

export const loadWasmInstance = async (
  importObj: any,
): Promise<MoneroCoreInstance | null> => {
  importObj.locateFile = locateFile;
  return instantiate(importObj);
};
