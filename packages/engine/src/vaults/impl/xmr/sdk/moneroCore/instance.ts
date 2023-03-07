import { loadWasmInstance } from './load';

import type { MoneroCoreInstance } from './moneroCoreTypes';
import type { CppBridge } from 'react-native-mymonero-core';

let inst = null;

const instPromise = (async () => {
  inst = await loadWasmInstance({});
  if (!inst) {
    throw Error('WASM was not loaded');
  }
  return inst;
})();

export const getMoneroCoreInstance = async (): Promise<
  MoneroCoreInstance | CppBridge
> => instPromise;
