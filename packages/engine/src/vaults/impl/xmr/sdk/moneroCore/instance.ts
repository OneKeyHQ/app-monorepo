import { loadWasmInstance } from './load';

import type { MoneroCoreInstance } from './moneroCoreTypes';

let inst = null;

const instPromise = (async () => {
  inst = await loadWasmInstance({});
  if (!inst) {
    throw Error('WASM was not loaded');
  }
  return inst;
})();

export const getMoneroCoreInstance = async (): Promise<MoneroCoreInstance> =>
  instPromise;
