import { COINTYPE_ETH, IMPL_EVM } from '../constants';

const implToCoinTypes: Record<string, Set<string>> = {};
implToCoinTypes[IMPL_EVM] = new Set([COINTYPE_ETH]);

function isCoinTypeCompatibleWithImpl(coinType: string, impl: string): boolean {
  return (implToCoinTypes[impl] || new Set()).has(coinType);
}

export { isCoinTypeCompatibleWithImpl };
