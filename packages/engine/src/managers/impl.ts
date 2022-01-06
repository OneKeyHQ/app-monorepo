import { COINTYPE_ETH, IMPL_EVM } from '../constants';

const implToCoinTypes: Record<string, string> = {
  [IMPL_EVM]: COINTYPE_ETH,
};

function isCoinTypeCompatibleWithImpl(coinType: string, impl: string): boolean {
  return implToCoinTypes[impl] === coinType;
}

export { implToCoinTypes, isCoinTypeCompatibleWithImpl };
