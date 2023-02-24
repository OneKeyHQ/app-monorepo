import instantiate from './monero-core';

export const loadWasmInstance = async (importObj: any): Promise<any> => {
  return await instantiate(importObj);
};
