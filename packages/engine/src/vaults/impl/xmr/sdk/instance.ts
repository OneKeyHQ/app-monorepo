import { loadWasmInstance } from './load';

import type { MoneroCoreInstance } from './moneroTypes';

let inst = null;

const instPromise = (async () => {
  inst = await loadWasmInstance({});
  if (!inst) {
    throw Error('WASM was not loaded');
  }
  return inst;
})();

export const getInstance = async (): Promise<MoneroCoreInstance> => instPromise;
