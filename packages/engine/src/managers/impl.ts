import {
  COINTYPE_ALGO,
  COINTYPE_ETH,
  COINTYPE_NEAR,
  COINTYPE_SOL,
  IMPL_ALGO,
  IMPL_EVM,
  IMPL_NEAR,
  IMPL_SOL,
} from '../constants';

const implToCoinTypes: Record<string, string> = {
  [IMPL_EVM]: COINTYPE_ETH,
  [IMPL_SOL]: COINTYPE_SOL,
  [IMPL_ALGO]: COINTYPE_ALGO,
  [IMPL_NEAR]: COINTYPE_NEAR,
};

function isCoinTypeCompatibleWithImpl(coinType: string, impl: string): boolean {
  return implToCoinTypes[impl] === coinType;
}

export { implToCoinTypes, isCoinTypeCompatibleWithImpl };
