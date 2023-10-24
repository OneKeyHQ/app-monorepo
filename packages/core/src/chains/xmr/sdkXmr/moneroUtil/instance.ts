import type { MoneroUtilInstance } from './moneroUtilTypes';

let inst: MoneroUtilInstance | null = null;

export const getMoneroUtilInstance = async (): Promise<MoneroUtilInstance> => {
  const { loadWasmInstance } = require('./load') as typeof import('./load');
  if (!inst) {
    inst = await loadWasmInstance({});
  }
  if (!inst) {
    throw Error('WASM was not loaded');
  }
  return inst;
};
