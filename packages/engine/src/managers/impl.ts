import {
  COINTYPE_ALGO,
  COINTYPE_CFX,
  COINTYPE_ETH,
  COINTYPE_NEAR,
  COINTYPE_SOL,
  COINTYPE_STC,
  IMPL_ALGO,
  IMPL_CFX,
  IMPL_EVM,
  IMPL_NEAR,
  IMPL_SOL,
  IMPL_STC,
} from '../constants';
import { AccountType } from '../types/account';

const implToCoinTypes: Record<string, string> = {
  [IMPL_EVM]: COINTYPE_ETH,
  [IMPL_SOL]: COINTYPE_SOL,
  [IMPL_ALGO]: COINTYPE_ALGO,
  [IMPL_NEAR]: COINTYPE_NEAR,
  [IMPL_STC]: COINTYPE_STC,
  [IMPL_CFX]: COINTYPE_CFX,
};

const implToAccountType: Record<string, AccountType> = {
  [IMPL_EVM]: AccountType.SIMPLE,
  [IMPL_SOL]: AccountType.SIMPLE,
  [IMPL_ALGO]: AccountType.SIMPLE,
  [IMPL_NEAR]: AccountType.SIMPLE,
  [IMPL_STC]: AccountType.SIMPLE,
  [IMPL_CFX]: AccountType.VARIANT,
};

function isCoinTypeCompatibleWithImpl(coinType: string, impl: string): boolean {
  return implToCoinTypes[impl] === coinType;
}

export { implToCoinTypes, implToAccountType, isCoinTypeCompatibleWithImpl };
