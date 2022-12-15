import {
  COINTYPE_ADA,
  COINTYPE_ALGO,
  COINTYPE_APTOS,
  COINTYPE_BCH,
  COINTYPE_BTC,
  COINTYPE_CFX,
  COINTYPE_COSMOS,
  COINTYPE_DOGE,
  COINTYPE_ETH,
  COINTYPE_FIL,
  COINTYPE_LTC,
  COINTYPE_NEAR,
  COINTYPE_SOL,
  COINTYPE_STC,
  COINTYPE_SUI,
  COINTYPE_TBTC,
  COINTYPE_TRON,
  COINTYPE_XRP,
  IMPL_ADA,
  IMPL_ALGO,
  IMPL_APTOS,
  IMPL_BCH,
  IMPL_BTC,
  IMPL_CFX,
  IMPL_COSMOS,
  IMPL_DOGE,
  IMPL_EVM,
  IMPL_FIL,
  IMPL_LTC,
  IMPL_NEAR,
  IMPL_SOL,
  IMPL_STC,
  IMPL_SUI,
  IMPL_TBTC,
  IMPL_TRON,
  IMPL_XRP,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { NotImplemented } from '../errors';
import { AccountType } from '../types/account';

import type { AccountNameInfo } from '../types/network';

enum Curve {
  SECP256K1 = 'secp256k1',
  ED25519 = 'ed25519',
}

const implToCoinTypes: Partial<Record<string, string>> = {
  [IMPL_EVM]: COINTYPE_ETH,
  [IMPL_SOL]: COINTYPE_SOL,
  [IMPL_ALGO]: COINTYPE_ALGO,
  [IMPL_NEAR]: COINTYPE_NEAR,
  [IMPL_STC]: COINTYPE_STC,
  [IMPL_CFX]: COINTYPE_CFX,
  [IMPL_BTC]: COINTYPE_BTC,
  [IMPL_TBTC]: COINTYPE_TBTC,
  [IMPL_TRON]: COINTYPE_TRON,
  [IMPL_APTOS]: COINTYPE_APTOS,
  [IMPL_DOGE]: COINTYPE_DOGE,
  [IMPL_LTC]: COINTYPE_LTC,
  [IMPL_BCH]: COINTYPE_BCH,
  [IMPL_XRP]: COINTYPE_XRP,
  [IMPL_COSMOS]: COINTYPE_COSMOS,
  [IMPL_ADA]: COINTYPE_ADA,
  [IMPL_SUI]: COINTYPE_SUI,
  [IMPL_FIL]: COINTYPE_FIL,
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
  [IMPL_TBTC]: AccountType.UTXO,
  [IMPL_TRON]: AccountType.SIMPLE,
  [IMPL_APTOS]: AccountType.SIMPLE,
  [IMPL_DOGE]: AccountType.UTXO,
  [IMPL_LTC]: AccountType.UTXO,
  [IMPL_BCH]: AccountType.UTXO,
  [IMPL_XRP]: AccountType.SIMPLE,
  [IMPL_COSMOS]: AccountType.VARIANT,
  [IMPL_ADA]: AccountType.UTXO,
  [IMPL_SUI]: AccountType.SIMPLE,
  [IMPL_FIL]: AccountType.VARIANT,
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
  [IMPL_TBTC]: Curve.SECP256K1,
  [IMPL_TRON]: Curve.SECP256K1,
  [IMPL_APTOS]: Curve.ED25519,
  [IMPL_DOGE]: Curve.SECP256K1,
  [IMPL_LTC]: Curve.SECP256K1,
  [IMPL_BCH]: Curve.SECP256K1,
  [IMPL_XRP]: Curve.SECP256K1,
  [IMPL_COSMOS]: Curve.SECP256K1,
  [IMPL_ADA]: Curve.ED25519,
  [IMPL_SUI]: Curve.ED25519,
  [IMPL_FIL]: Curve.SECP256K1,
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
  [IMPL_EVM]: { default: { prefix: 'EVM', category: `44'/${COINTYPE_ETH}'` } },
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
    default: {
      prefix: 'BTC Nested SegWit',
      category: `49'/${COINTYPE_BTC}'`,
      label: 'Nested SegWit (P2SH)',
      addressPrefix: '3',
    },
    BIP44: {
      prefix: 'BTC Legacy',
      category: `44'/${COINTYPE_BTC}'`,
      label: 'Legacy (P2PKH)',
      addressPrefix: '1',
    },
    BIP84: {
      prefix: 'BTC Native SegWit',
      category: `84'/${COINTYPE_BTC}'`,
      label: 'Native SegWit',
      addressPrefix: 'bc1',
    },
  },
  [IMPL_TBTC]: {
    default: {
      prefix: 'TBTC Nested SegWit',
      category: `49'/${COINTYPE_TBTC}'`,
      label: 'Nested SegWit (P2SH)',
      addressPrefix: '2',
    },
    BIP44: {
      prefix: 'TBTC Legacy',
      category: `44'/${COINTYPE_TBTC}'`,
      label: 'Legacy (P2PKH)',
      addressPrefix: 'm',
    },
    BIP84: {
      prefix: 'TBTC Native SegWit',
      category: `84'/${COINTYPE_TBTC}'`,
      label: 'Native SegWit',
      addressPrefix: 'tb1',
    },
  },
  [IMPL_TRON]: {
    default: { prefix: 'TRON', category: `44'/${COINTYPE_TRON}'` },
  },
  [IMPL_APTOS]: {
    default: { prefix: 'APT', category: `44'/${COINTYPE_APTOS}'` },
  },
  [IMPL_DOGE]: {
    default: {
      prefix: 'DOGE',
      category: `44'/${COINTYPE_DOGE}'`,
      label: 'Legacy (P2PKH)',
    },
  },
  [IMPL_LTC]: {
    default: {
      prefix: 'LTC Nested SegWit',
      category: `49'/${COINTYPE_LTC}'`,
      label: 'Nested SegWit (P2SH)',
      addressPrefix: 'M',
    },
    BIP44: {
      prefix: 'LTC Legacy',
      category: `44'/${COINTYPE_LTC}'`,
      label: 'Legacy (P2PKH)',
      addressPrefix: 'L',
    },
    BIP84: {
      prefix: 'LTC Native SegWit',
      category: `84'/${COINTYPE_LTC}'`,
      label: 'Native SegWit',
      addressPrefix: 'ltc1',
    },
  },
  [IMPL_BCH]: {
    default: {
      prefix: 'BCH',
      category: `44'/${COINTYPE_BCH}'`,
      label: 'Legacy (P2PKH)',
    },
  },
  [IMPL_XRP]: {
    default: { prefix: 'RIPPLE', category: `44'/${COINTYPE_XRP}'` },
  },
  [IMPL_COSMOS]: {
    default: { prefix: 'COSMOS', category: `44'/${COINTYPE_COSMOS}'` },
  },
  [IMPL_ADA]: {
    default: { prefix: 'CARDANO', category: `1852'/${COINTYPE_ADA}'` },
  },
  [IMPL_SUI]: {
    default: { prefix: 'SUI', category: `44'/${COINTYPE_SUI}'` },
  },
  [IMPL_FIL]: {
    default: { prefix: 'FIL', category: `44'/${COINTYPE_FIL}'` },
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
