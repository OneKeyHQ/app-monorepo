/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import instantiate from './moneroUtil';
import wasmBinaryFileName from './moneroUtil.wasm.bin';

import type { MoneroUtilInstance } from './moneroUtilTypes';

const locateFile = (file: string) => {
  if (file !== 'moneroUtil.wasm') {
    console.error('Unexpected file:', file);
  }
  return wasmBinaryFileName;
};

export const loadWasmInstance = async (
  importObj: any,
): Promise<MoneroUtilInstance | null> => {
  importObj.locateFile = locateFile;
  return instantiate(importObj);
};
