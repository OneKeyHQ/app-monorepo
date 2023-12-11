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
  COINTYPE_KASPA,
  COINTYPE_LIGHTNING,
  COINTYPE_LIGHTNING_TESTNET,
  COINTYPE_LTC,
  COINTYPE_NEAR,
  COINTYPE_NEXA,
  COINTYPE_NOSTR,
  COINTYPE_SOL,
  COINTYPE_STC,
  COINTYPE_SUI,
  COINTYPE_TBTC,
  COINTYPE_TRON,
  COINTYPE_XMR,
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
  IMPL_KASPA,
  IMPL_LIGHTNING,
  IMPL_LIGHTNING_TESTNET,
  IMPL_LTC,
  IMPL_NEAR,
  IMPL_NEXA,
  IMPL_NOSTR,
  IMPL_SOL,
  IMPL_STC,
  IMPL_SUI,
  IMPL_TBTC,
  IMPL_TRON,
  IMPL_XMR,
  IMPL_XRP,
  getSupportedImpls,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { NotImplemented } from '../errors';
import { AccountType } from '../types/account';
import { createVaultSettings } from '../vaults/factory.createVaultSettings';

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
  [IMPL_XMR]: COINTYPE_XMR,
  [IMPL_KASPA]: COINTYPE_KASPA,
  [IMPL_NEXA]: COINTYPE_NEXA,
  [IMPL_LIGHTNING]: COINTYPE_LIGHTNING,
  [IMPL_LIGHTNING_TESTNET]: COINTYPE_LIGHTNING_TESTNET,
  [IMPL_NOSTR]: COINTYPE_NOSTR,
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
  [IMPL_XMR]: AccountType.VARIANT,
  [IMPL_KASPA]: AccountType.SIMPLE,
  [IMPL_LIGHTNING]: AccountType.VARIANT,
  [IMPL_LIGHTNING_TESTNET]: AccountType.VARIANT,
  [IMPL_NOSTR]: AccountType.VARIANT,
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
  [IMPL_NEXA]: Curve.SECP256K1,
  [IMPL_XRP]: Curve.SECP256K1,
  [IMPL_COSMOS]: Curve.SECP256K1,
  [IMPL_ADA]: Curve.ED25519,
  [IMPL_SUI]: Curve.ED25519,
  [IMPL_FIL]: Curve.SECP256K1,
  [IMPL_DOT]: Curve.ED25519,
  [IMPL_XMR]: Curve.ED25519,
  [IMPL_KASPA]: Curve.SECP256K1,
  [IMPL_LIGHTNING]: Curve.SECP256K1,
  [IMPL_LIGHTNING_TESTNET]: Curve.SECP256K1,
  [IMPL_NOSTR]: Curve.SECP256K1,
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

function getAccountNameInfoByImpl(
  impl: string,
): Record<string, AccountNameInfo> {
  const vaultSetting = createVaultSettings({ impl });
  const ret = vaultSetting.accountNameInfo;
  if (typeof ret === 'undefined') {
    throw new NotImplemented(`Implementation ${impl} is not supported.`);
  }
  return ret;
}

function getDefaultAccountNameInfoByImpl(impl: string): AccountNameInfo {
  const ret = getAccountNameInfoByImpl(impl);
  if (typeof ret.default === 'undefined') {
    throw new NotImplemented(`Implementation ${impl} is not supported.`);
  }
  return ret.default;
}

function getAccountNameInfoByTemplate(
  impl: string,
  template: string,
): AccountNameInfo {
  const ret = getAccountNameInfoByImpl(impl);
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
  // The following three chains need to find the corresponding template according to the purpose of the account
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

type IAllChainAccountNameInfo = Record<string, Record<string, AccountNameInfo>>;
// For database migration, wallets.nextAccountIds
function convertCategoryToTemplate(
  category: string,
  allChainAccountNameInfo: IAllChainAccountNameInfo,
) {
  for (const [impl, accountInfo] of Object.entries(allChainAccountNameInfo)) {
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

function migrateNextAccountIds(nextAccountIds: Record<string, number>) {
  const allChainAccountNameInfo = [
    ...getSupportedImpls(),
  ].reduce<IAllChainAccountNameInfo>(
    (acc, impl) => ({
      ...acc,
      [impl]: getAccountNameInfoByImpl(impl),
    }),
    {},
  );
  const newNextAccountIds = { ...nextAccountIds };
  for (const [category, value] of Object.entries(nextAccountIds)) {
    const template = convertCategoryToTemplate(
      category,
      allChainAccountNameInfo,
    );
    if (template && !newNextAccountIds[template]) {
      newNextAccountIds[template] = value;
    }
  }
  return newNextAccountIds;
}

function isBtcLikeImpl(impl: string): boolean {
  return [IMPL_BTC, IMPL_TBTC, IMPL_LTC, IMPL_BCH, IMPL_DOGE].includes(impl);
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
  migrateNextAccountIds,
  isBtcLikeImpl,
};
