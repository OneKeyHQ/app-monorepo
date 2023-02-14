import { flatten } from 'lodash';

import {
  COINTYPE_ADA,
  COINTYPE_ALGO,
  COINTYPE_APTOS,
  COINTYPE_BCH,
  COINTYPE_BTC,
  COINTYPE_CFX,
  COINTYPE_COSMOS,
  COINTYPE_DOGE,
  COINTYPE_DOT,
  COINTYPE_ETC,
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
  IMPL_DOT,
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

import type { DBAccount } from '../types/account';
import type { AccountNameInfo } from '../types/network';

enum Curve {
  SECP256K1 = 'secp256k1',
  ED25519 = 'ed25519',
}

const implToCoinTypes: Partial<Record<string, string | string[]>> = {
  [IMPL_EVM]: [COINTYPE_ETH, COINTYPE_ETC],
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
  [IMPL_DOT]: COINTYPE_DOT,
};

const coinTypeToImpl: Record<string, string> = Object.fromEntries(
  flatten(
    Object.entries(implToCoinTypes).map(([k, v]) =>
      Array.isArray(v) ? v.map((coinType: string) => [coinType, k]) : [[v, k]],
    ),
  ),
);

function getImplByCoinType(coinType: string) {
  return coinTypeToImpl[coinType];
}

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
  [IMPL_DOT]: AccountType.VARIANT,
};

function isCoinTypeCompatibleWithImpl(coinType: string, impl: string): boolean {
  return Array.isArray(implToCoinTypes[impl])
    ? !!implToCoinTypes[impl]?.includes(coinType)
    : implToCoinTypes[impl] === coinType;
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
  [IMPL_DOT]: Curve.ED25519,
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
  [IMPL_EVM]: {
    default: {
      prefix: 'EVM',
      category: `44'/${COINTYPE_ETH}'`,
      template: `m/44'/${COINTYPE_ETH}'/0'/0/x`,
      coinType: COINTYPE_ETH,
      label: { id: 'form__bip44_standard' },
      desc: { id: `form__bip44_standard_desc` },
      recommended: true,
    },
    etcNative: {
      prefix: 'ETC-Native',
      category: `44'/${COINTYPE_ETC}'`,
      template: `m/44'/${COINTYPE_ETC}'/0'/0/x`,
      coinType: COINTYPE_ETC,
      label: { id: 'form__bip44_standard_cointype_61' },
    },
    ledgerLive: {
      prefix: 'Ledger Live',
      category: `44'/${COINTYPE_ETH}'`,
      template: `m/44'/${COINTYPE_ETH}'/x'/0/0`,
      coinType: COINTYPE_ETH,
      label: 'Ledger Live',
    },
  },
  [IMPL_SOL]: {
    default: {
      prefix: 'SOL',
      category: `44'/${COINTYPE_SOL}'`,
      template: `m/44'/${COINTYPE_SOL}'/x'/0'`,
      coinType: COINTYPE_SOL,
      label: { id: 'form__bip44_standard' },
      desc: 'OneKey, Phantom, Sollet',
      recommended: true,
    },
    ledgerLive: {
      prefix: 'Ledger Live',
      category: `44'/${COINTYPE_SOL}'`,
      template: `m/44'/${COINTYPE_SOL}'/x'`,
      coinType: COINTYPE_SOL,
      label: 'Ledger Live',
      desc: 'Ledger Live, Solflare',
    },
  },
  [IMPL_ALGO]: {
    default: {
      prefix: 'ALGO',
      category: `44'/${COINTYPE_ALGO}'`,
      template: `m/44'/${COINTYPE_ALGO}'/0'/0'/x'`,
      coinType: COINTYPE_ALGO,
    },
  },
  [IMPL_NEAR]: {
    default: {
      prefix: 'NEAR',
      category: `44'/${COINTYPE_NEAR}'`,
      template: `m/44'/${COINTYPE_NEAR}'/x'`,
      coinType: COINTYPE_NEAR,
    },
  },
  [IMPL_STC]: {
    default: {
      prefix: 'STC',
      category: `44'/${COINTYPE_STC}'`,
      template: `m/44'/${COINTYPE_STC}'/0'/0'/x'`,
      coinType: COINTYPE_STC,
    },
  },
  [IMPL_CFX]: {
    default: {
      prefix: 'CFX',
      category: `44'/${COINTYPE_CFX}'`,
      template: `m/44'/503'/0'/0/x`,
      coinType: COINTYPE_CFX,
    },
  },
  [IMPL_BTC]: {
    default: {
      prefix: 'BTC Nested SegWit',
      category: `49'/${COINTYPE_BTC}'`,
      template: `m/49'/${COINTYPE_BTC}'/x'/0/0`,
      coinType: COINTYPE_BTC,
      label: 'Nested SegWit',
      desc: {
        id: 'form__bitcoin__nested_segwit_desc',
        placeholder: { 0: '3' },
      },
      subDesc: 'BIP49, P2SH-P2WPKH, Base58.',
    },
    BIP84: {
      prefix: 'BTC Native SegWit',
      category: `84'/${COINTYPE_BTC}'`,
      template: `m/84'/${COINTYPE_BTC}'/x'/0/0`,
      coinType: COINTYPE_BTC,
      label: 'Native SegWit',
      desc: {
        id: 'form__bitcoin__native_segwit_desc',
        placeholder: { 0: 'bc1' },
      },
      subDesc: 'BIP84, P2WPKH, Bech32.',
    },
    BIP44: {
      prefix: 'BTC Legacy',
      category: `44'/${COINTYPE_BTC}'`,
      template: `m/44'/${COINTYPE_BTC}'/x'/0/0`,
      coinType: COINTYPE_BTC,
      label: 'Legacy',
      desc: { id: 'form__bitcoin__legacy_desc', placeholder: { 0: '1' } },
      subDesc: 'BIP44, P2PKH, Base58.',
      notRecommended: true,
    },
  },
  [IMPL_TBTC]: {
    default: {
      prefix: 'TBTC Nested SegWit',
      category: `49'/${COINTYPE_TBTC}'`,
      template: `m/49'/${COINTYPE_TBTC}'/x'/0/0`,
      coinType: COINTYPE_TBTC,
      label: 'Nested SegWit',
      desc: {
        id: 'form__bitcoin__nested_segwit_desc',
        placeholder: { 0: '2' },
      },
      subDesc: 'BIP49, P2SH-P2WPKH, Base58.',
    },
    BIP44: {
      prefix: 'TBTC Legacy',
      category: `44'/${COINTYPE_TBTC}'`,
      template: `m/44'/${COINTYPE_TBTC}'/x'/0/0`,
      coinType: COINTYPE_TBTC,
      label: 'Legacy',
      desc: { id: 'form__bitcoin__legacy_desc', placeholder: { 0: 'm' } },
      subDesc: 'BIP44, P2PKH, Base58.',
    },
    BIP84: {
      prefix: 'TBTC Native SegWit',
      category: `84'/${COINTYPE_TBTC}'`,
      template: `m/84'/${COINTYPE_TBTC}'/x'/0/0`,
      coinType: COINTYPE_TBTC,
      label: 'Native SegWit',
      desc: {
        id: 'form__bitcoin__native_segwit_desc',
        placeholder: { 0: 'tb1' },
      },
      subDesc: 'BIP84, P2WPKH, Bech32. ',
    },
  },
  [IMPL_TRON]: {
    default: {
      prefix: 'TRON',
      category: `44'/${COINTYPE_TRON}'`,
      template: `m/44'/${COINTYPE_TRON}'/0'/0/x`,
      coinType: COINTYPE_TRON,
    },
  },
  [IMPL_APTOS]: {
    default: {
      prefix: 'APT',
      category: `44'/${COINTYPE_APTOS}'`,
      template: `m/44'/${COINTYPE_APTOS}'/x'/0'/0'`,
      coinType: COINTYPE_APTOS,
    },
  },
  [IMPL_DOGE]: {
    default: {
      prefix: 'DOGE',
      category: `44'/${COINTYPE_DOGE}'`,
      template: `m/44'/${COINTYPE_DOGE}'/x'/0/0`,
      coinType: COINTYPE_DOGE,
      label: 'Legacy',
      subDesc: 'BIP44, P2PKH, Base58.',
    },
  },
  [IMPL_LTC]: {
    default: {
      prefix: 'LTC Nested SegWit',
      category: `49'/${COINTYPE_LTC}'`,
      template: `m/49'/${COINTYPE_LTC}'/x'/0/0`,
      coinType: COINTYPE_LTC,
      label: 'Nested SegWit',
      desc: {
        id: 'form__bitcoin__nested_segwit_desc',
        placeholder: { 0: 'M' },
      },
      subDesc: 'BIP49, P2SH-P2WPKH, Base58.',
    },
    BIP84: {
      prefix: 'LTC Native SegWit',
      category: `84'/${COINTYPE_LTC}'`,
      template: `m/84'/${COINTYPE_LTC}'/x'/0/0`,
      coinType: COINTYPE_LTC,
      label: 'Native SegWit',
      desc: {
        id: 'form__bitcoin__native_segwit_desc',
        placeholder: { 0: 'ltc1' },
      },
      subDesc: 'BIP84, P2WPKH, Bech32. ',
    },
    BIP44: {
      prefix: 'LTC Legacy',
      category: `44'/${COINTYPE_LTC}'`,
      template: `m/44'/${COINTYPE_LTC}'/x'/0/0`,
      coinType: COINTYPE_LTC,
      label: 'Legacy',
      desc: { id: 'form__bitcoin__legacy_desc', placeholder: { 0: 'L' } },
      subDesc: 'BIP44, P2PKH, Base58.',
      notRecommended: true,
    },
  },
  [IMPL_BCH]: {
    default: {
      prefix: 'BCH',
      category: `44'/${COINTYPE_BCH}'`,
      template: `m/44'/${COINTYPE_BCH}'/x'/0/0`,
      coinType: COINTYPE_BCH,
      label: 'Legacy',
      subDesc: 'BIP44, P2PKH, Base58.',
    },
  },
  [IMPL_XRP]: {
    default: {
      prefix: 'RIPPLE',
      category: `44'/${COINTYPE_XRP}'`,
      template: `m/44'/${COINTYPE_XRP}'/x'/0/0`,
      coinType: COINTYPE_XRP,
    },
  },
  [IMPL_COSMOS]: {
    default: {
      prefix: 'COSMOS',
      category: `44'/${COINTYPE_COSMOS}'`,
      template: `m/44'/${COINTYPE_COSMOS}'/x'/0/0`,
      coinType: COINTYPE_COSMOS,
    },
  },
  [IMPL_ADA]: {
    default: {
      prefix: 'CARDANO',
      category: `1852'/${COINTYPE_ADA}'`,
      template: `m/1852'/${COINTYPE_ADA}'/x'/0/0`,
      coinType: COINTYPE_ADA,
    },
  },
  [IMPL_SUI]: {
    default: {
      prefix: 'SUI',
      category: `44'/${COINTYPE_SUI}'`,
      template: `m/44'/${COINTYPE_SUI}'/x'/0'/0'`,
      coinType: COINTYPE_SUI,
    },
  },
  [IMPL_FIL]: {
    default: {
      prefix: 'FIL',
      category: `44'/${COINTYPE_FIL}'`,
      template: `m/44'/${COINTYPE_FIL}'/0'/0/x`,
      coinType: COINTYPE_FIL,
    },
  },
  [IMPL_DOT]: {
    default: {
      prefix: 'DOT',
      category: `44'/${COINTYPE_DOT}'`,
      template: `m/44'/${COINTYPE_DOT}'/x'/0'/0'`,
      coinType: COINTYPE_DOT,
    },
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

function getDefaultAccountNameInfoByImpl(impl: string): AccountNameInfo {
  const ret = defaultAccountNameInfo[impl];
  if (typeof ret.default === 'undefined') {
    throw new NotImplemented(`Implementation ${impl} is not supported.`);
  }
  return ret.default;
}

function getAccountNameInfoByTemplate(
  impl: string,
  template: string,
): AccountNameInfo {
  const ret = defaultAccountNameInfo[impl];
  if (typeof ret === 'undefined') {
    throw new NotImplemented(`Is not supported for implementation ${impl}.`);
  }
  const accountNameInfo = Object.values(ret).find(
    (value) => value.template === template,
  );
  if (typeof accountNameInfo === 'undefined') {
    throw new NotImplemented(`template ${template} not supported.`);
  }
  return accountNameInfo;
}

function getDBAccountTemplate(account: DBAccount) {
  const { coinType, path, template } = account;
  const impl = coinTypeToImpl[coinType];
  if (template) {
    return template;
  }
  if ([IMPL_BTC, IMPL_TBTC, IMPL_LTC].includes(impl)) {
    for (const accountInfo of Object.values(getAccountNameInfoByImpl(impl))) {
      if (path.indexOf(accountInfo.category) > -1) {
        return accountInfo.template;
      }
    }
  }
  const defaultAccountInfo = getDefaultAccountNameInfoByImpl(impl);
  return defaultAccountInfo.template;
}

// For database migration, wallets.nextAccountIds
function convertCategoryToTemplate(category: string) {
  for (const [impl, accountInfo] of Object.entries(defaultAccountNameInfo)) {
    for (const info of Object.values(accountInfo)) {
      if (info.category === category) {
        if (
          (impl === IMPL_EVM && category === `44'/${COINTYPE_ETH}'`) ||
          impl === IMPL_SOL
        ) {
          return accountInfo.default.template;
        }
        return info.template;
      }
    }
  }
}

export {
  implToCoinTypes,
  implToAccountType,
  coinTypeToImpl,
  isCoinTypeCompatibleWithImpl,
  defaultCurveMap,
  getCurveByImpl,
  getDefaultCurveByCoinType,
  getAccountNameInfoByImpl,
  getDefaultAccountNameInfoByImpl,
  getAccountNameInfoByTemplate,
  getDBAccountTemplate,
  getImplByCoinType,
  convertCategoryToTemplate,
};
