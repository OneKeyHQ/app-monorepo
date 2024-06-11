import type { IMoneroCoreInstance } from './moneroCoreTypes';

let inst: IMoneroCoreInstance | null = null;

export const getMoneroCoreInstance = async (): Promise<IMoneroCoreInstance> => {
  const { loadWasmInstance } = require('./load') as typeof import('./load');
  if (!inst) {
    inst = await loadWasmInstance({});
  }
  if (!inst) {
    throw Error('WASM was not loaded');
  }
  return inst;
};
