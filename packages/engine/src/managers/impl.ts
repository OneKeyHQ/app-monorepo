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
import { NotImplemented } from '../errors';
import { AccountType } from '../types/account';

enum Curve {
  SECP256K1 = 'secp256k1',
  ED25519 = 'ed25519',
}

const implToCoinTypes: Record<string, string> = {
  [IMPL_EVM]: COINTYPE_ETH,
  [IMPL_SOL]: COINTYPE_SOL,
  [IMPL_ALGO]: COINTYPE_ALGO,
  [IMPL_NEAR]: COINTYPE_NEAR,
  [IMPL_STC]: COINTYPE_STC,
  [IMPL_CFX]: COINTYPE_CFX,
};

const coinTypeToImpl: Record<string, string> = Object.fromEntries(
  Object.entries(implToCoinTypes).map(([k, v]) => [v, k]),
);

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

const defaultCurveMap: Record<string, Curve> = {
  [IMPL_EVM]: Curve.SECP256K1,
  [IMPL_SOL]: Curve.ED25519,
  [IMPL_ALGO]: Curve.ED25519,
  [IMPL_NEAR]: Curve.ED25519,
  [IMPL_STC]: Curve.ED25519,
  [IMPL_CFX]: Curve.SECP256K1,
};

function getCurveByImpl(impl: string): string {
  const ret = defaultCurveMap[impl];
  if (typeof ret === 'undefined') {
    throw new NotImplemented(`Implementation ${impl} is not supported.`);
  }
  return ret;
}

function getDefaultCurveByCoinType(coinType: string): string {
  return getCurveByImpl(coinTypeToImpl[coinType]);
}

export {
  implToCoinTypes,
  implToAccountType,
  isCoinTypeCompatibleWithImpl,
  getCurveByImpl,
  getDefaultCurveByCoinType,
};
