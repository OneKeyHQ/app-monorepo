import { COINTYPE_ETH, COINTYPE_SOL, IMPL_EVM, IMPL_SOL } from '../constants';

const implToCoinTypes: Record<string, string> = {
  [IMPL_EVM]: COINTYPE_ETH,
  [IMPL_SOL]: COINTYPE_SOL,
};

function isCoinTypeCompatibleWithImpl(coinType: string, impl: string): boolean {
  return implToCoinTypes[impl] === coinType;
}

export { implToCoinTypes, isCoinTypeCompatibleWithImpl };
