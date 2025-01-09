/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import instantiate from './moneroUtil';
// @ts-ignore
import wasmBinaryFileName from './moneroUtil.wasm.bin';

import type { IMoneroUtilInstance } from './moneroUtilTypes';

const locateFile = (file: string) => {
  if (file !== 'moneroUtil.wasm') {
    console.error('Unexpected file:', file);
  }
  return wasmBinaryFileName;
};

export const loadWasmInstance = async (
  importObj: any,
): Promise<IMoneroUtilInstance | null> => {
  importObj.locateFile = locateFile;
  return instantiate(importObj);
};
