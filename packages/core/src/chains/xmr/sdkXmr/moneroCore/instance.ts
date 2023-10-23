import type { MoneroCoreInstance } from './moneroCoreTypes';

let inst: MoneroCoreInstance | null = null;

export const getMoneroCoreInstance = async (): Promise<MoneroCoreInstance> => {
  const { loadWasmInstance } = require('./load') as typeof import('./load');
  if (!inst) {
    inst = await loadWasmInstance({});
  }
  if (!inst) {
    throw Error('WASM was not loaded');
  }
  return inst;
};
