import type { IMoneroUtilInstance } from './moneroUtilTypes';

let inst: IMoneroUtilInstance | null = null;

export const getMoneroUtilInstance = async (): Promise<IMoneroUtilInstance> => {
  const { loadWasmInstance } = require('./load') as typeof import('./load');
  if (!inst) {
    inst = await loadWasmInstance({});
  }
  if (!inst) {
    throw Error('WASM was not loaded');
  }
  return inst;
};
