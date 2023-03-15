import { loadWasmInstance } from './load';

import type { MoneroUtilInstance } from './moneroUtilTypes';

let inst = null;

const instPromise = (async () => {
  inst = await loadWasmInstance({});
  if (!inst) {
    throw Error('WASM was not loaded');
  }
  return inst;
})();

export const getMoneroUtilInstance = async (): Promise<MoneroUtilInstance> =>
  instPromise;
