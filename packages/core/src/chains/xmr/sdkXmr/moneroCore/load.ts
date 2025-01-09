/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import instantiate from './moneroCore';
// @ts-ignore
import wasmBinaryFileName from './moneroCore.wasm.bin';

import type { IMoneroCoreInstance } from './moneroCoreTypes';

const locateFile = (file: string) => {
  if (file !== 'moneroCore.wasm') {
    console.error('Unexpected file:', file);
  }
  return wasmBinaryFileName;
};

export const loadWasmInstance = async (
  importObj: any,
): Promise<IMoneroCoreInstance | null> => {
  importObj.locateFile = locateFile;
  return instantiate(importObj);
};
