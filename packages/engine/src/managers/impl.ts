import {
  COINTYPE_ALGO,
  COINTYPE_BTC,
  COINTYPE_CFX,
  COINTYPE_ETH,
  COINTYPE_NEAR,
  COINTYPE_SOL,
  COINTYPE_STC,
  IMPL_ALGO,
  IMPL_BTC,
  IMPL_CFX,
  IMPL_EVM,
  IMPL_NEAR,
  IMPL_SOL,
  IMPL_STC,
} from '../constants';
import { NotImplemented } from '../errors';
import { AccountType } from '../types/account';
import { AccountNameInfo } from '../types/network';

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
  [IMPL_BTC]: COINTYPE_BTC,
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
  [IMPL_BTC]: AccountType.UTXO,
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
  [IMPL_BTC]: Curve.SECP256K1,
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

const defaultAccountNameInfo: Record<
  string,
  Record<string, AccountNameInfo>
> = {
  [IMPL_EVM]: { default: { prefix: 'ETH', category: `44'/${COINTYPE_ETH}'` } },
  [IMPL_SOL]: { default: { prefix: 'SOL', category: `44'/${COINTYPE_SOL}'` } },
  [IMPL_ALGO]: {
    default: { prefix: 'ALGO', category: `44'/${COINTYPE_ALGO}'` },
  },
  [IMPL_NEAR]: {
    default: { prefix: 'NEAR', category: `44'/${COINTYPE_NEAR}'` },
  },
  [IMPL_STC]: { default: { prefix: 'STC', category: `44'/${COINTYPE_STC}'` } },
  [IMPL_CFX]: { default: { prefix: 'CFX', category: `44'/${COINTYPE_CFX}'` } },
  [IMPL_BTC]: {
    default: { prefix: 'BTC Nested SegWit', category: `49'/${COINTYPE_BTC}'` },
  },
};

function getAccountNameInfoByImpl(
  impl: string,
): Record<string, AccountNameInfo> {
  const ret = defaultAccountNameInfo[impl];
  if (typeof ret === 'undefined') {
    throw new NotImplemented(`Implementation ${impl} is not supported.`);
  }
  return ret;
}

export {
  implToCoinTypes,
  implToAccountType,
  isCoinTypeCompatibleWithImpl,
  getCurveByImpl,
  getDefaultCurveByCoinType,
  getAccountNameInfoByImpl,
};
