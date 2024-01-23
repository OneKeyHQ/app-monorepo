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
  IMPL_LTC,
  IMPL_NEAR,
  IMPL_NOSTR,
  IMPL_SOL,
  IMPL_STC,
  IMPL_TBTC,
  IMPL_TRON,
  IMPL_XMR,
  IMPL_XRP,
  INDEX_PLACEHOLDER,
  SEPERATOR,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../errors';

import {
  getAccountNameInfoByTemplate,
  getDefaultAccountNameInfoByImpl,
  getImplByCoinType,
} from './impl';

import type { DBAccountDerivation } from '../types/accountDerivation';
import type { Wallet } from '../types/wallet';

const purposeMap: Record<string, Array<number>> = {
  [IMPL_EVM]: [44],
  [IMPL_SOL]: [44],
  [IMPL_ALGO]: [44],
  [IMPL_NEAR]: [44],
  [IMPL_STC]: [44],
  [IMPL_CFX]: [44],
  [IMPL_BTC]: [49, 44, 84],
  [IMPL_TBTC]: [49, 44, 84],
  [IMPL_TRON]: [44],
  [IMPL_APTOS]: [44],
  [IMPL_DOGE]: [44],
  [IMPL_LTC]: [49, 44, 84],
  [IMPL_BCH]: [44],
  [IMPL_XRP]: [44],
  [IMPL_COSMOS]: [44],
  [IMPL_ADA]: [1815],
  [COINTYPE_SUI]: [44], // [COINTYPE_SUI]: [44,54],
  [IMPL_FIL]: [44],
  [IMPL_DOT]: [44],
  [IMPL_XMR]: [44],
  [IMPL_KASPA]: [44],
  [IMPL_NOSTR]: [44],
};

// derive path template by coin types.
const INCREMENT_LEVEL_TAG = 'INCR';
const PURPOSE_TAG = 'PURPOSE';
const derivationPathTemplates: Record<string, string> = {
  [COINTYPE_ALGO]: `m/44'/${COINTYPE_ALGO}'/0'/0'/${INCREMENT_LEVEL_TAG}'`,
  // see https://aptos.dev/guides/building-your-own-wallet#supporting-1-mnemonic---n-account-wallets
  [COINTYPE_APTOS]: `m/44'/${COINTYPE_APTOS}'/${INCREMENT_LEVEL_TAG}'/0'/0'`,
  [COINTYPE_ETH]: `m/44'/${COINTYPE_ETH}'/0'/0/${INCREMENT_LEVEL_TAG}`,
  [COINTYPE_ETC]: `m/44'/${COINTYPE_ETC}'/0'/0/${INCREMENT_LEVEL_TAG}`,
  [COINTYPE_NEAR]: `m/44'/${COINTYPE_NEAR}'/${INCREMENT_LEVEL_TAG}'`,
  [COINTYPE_SOL]: `m/44'/${COINTYPE_SOL}'/${INCREMENT_LEVEL_TAG}'/0'`,
  [COINTYPE_STC]: `m/44'/${COINTYPE_STC}'/0'/0'/${INCREMENT_LEVEL_TAG}'`,
  [COINTYPE_CFX]: `m/44'/${COINTYPE_CFX}'/0'/0/${INCREMENT_LEVEL_TAG}`,
  [COINTYPE_BTC]: `m/${PURPOSE_TAG}'/${COINTYPE_BTC}'/${INCREMENT_LEVEL_TAG}'`,
  [COINTYPE_TBTC]: `m/${PURPOSE_TAG}'/${COINTYPE_TBTC}'/${INCREMENT_LEVEL_TAG}'`,
  [COINTYPE_TRON]: `m/44'/${COINTYPE_TRON}'/0'/0/${INCREMENT_LEVEL_TAG}`,
  [COINTYPE_DOGE]: `m/44'/${COINTYPE_DOGE}'/${INCREMENT_LEVEL_TAG}'`,
  [COINTYPE_LTC]: `m/${PURPOSE_TAG}'/${COINTYPE_LTC}'/${INCREMENT_LEVEL_TAG}'`,
  [COINTYPE_BCH]: `m/44'/${COINTYPE_BCH}'/${INCREMENT_LEVEL_TAG}'`,
  [COINTYPE_NEXA]: `m/44'/${COINTYPE_NEXA}'/${INCREMENT_LEVEL_TAG}'`,
  [COINTYPE_XRP]: `m/44'/${COINTYPE_XRP}'/${INCREMENT_LEVEL_TAG}'/0/0`,
  [COINTYPE_COSMOS]: `m/44'/${COINTYPE_COSMOS}'/0'/0/${INCREMENT_LEVEL_TAG}`,
  [COINTYPE_ADA]: `m/1852'/${COINTYPE_ADA}'/${INCREMENT_LEVEL_TAG}'`,
  [COINTYPE_SUI]: `m/44'/${COINTYPE_SUI}'/${INCREMENT_LEVEL_TAG}'/0'/0'`,
  [COINTYPE_FIL]: `m/44'/${COINTYPE_FIL}'/0'/0/${INCREMENT_LEVEL_TAG}`,
  [COINTYPE_DOT]: `m/44'/${COINTYPE_DOT}'/${INCREMENT_LEVEL_TAG}'/0'/0'`,
  [COINTYPE_XMR]: `m/44'/${COINTYPE_XMR}'/0'/0/${INCREMENT_LEVEL_TAG}`,
  [COINTYPE_KASPA]: `m/44'/${COINTYPE_KASPA}'/0'/0/${INCREMENT_LEVEL_TAG}`,
  [COINTYPE_LIGHTNING]: `m/44'/${COINTYPE_LIGHTNING}'/${INCREMENT_LEVEL_TAG}`,
  [COINTYPE_LIGHTNING_TESTNET]: `m/44'/${COINTYPE_LIGHTNING_TESTNET}'/${INCREMENT_LEVEL_TAG}`,
  [COINTYPE_NOSTR]: `m/44'/${COINTYPE_NOSTR}'/${INCREMENT_LEVEL_TAG}'`,
};

function getDerivationPaths(
  purpose: string,
  coinType: string,
  indexes: Array<number>,
): { prefix: string; depth: number; relPaths: Array<string> } {
  if (indexes.some((index) => index >= 2 ** 31)) {
    throw new OneKeyInternalError(
      'Invalid child index, should be less than 2^31.',
    );
  }

  const template = derivationPathTemplates[coinType];
  if (typeof template === 'undefined') {
    throw new OneKeyInternalError(`Unsupported coinType ${coinType}.`);
  }
  const [prefix, suffix] = template.split(INCREMENT_LEVEL_TAG);
  const relPaths = indexes.map((index) => `${index}${suffix}`);
  return {
    prefix: prefix.slice(0, -1).replace(PURPOSE_TAG, purpose),
    depth: template.split('/').length - 1,
    relPaths,
  };
}

function getPath(purpose: string, coinType: string, index: number) {
  const { prefix, relPaths } = getDerivationPaths(purpose, coinType, [index]);
  return `${prefix}/${relPaths[0]}`;
}

function getDefaultPurpose(impl: string): number {
  return (purposeMap[impl] || [44])[0];
}

/**
 * m/44'/60'/x'/0/0 -> m/44'/60' for prefix, {index}/0/0 for suffix
 * @param template derivation path template
 * @returns string
 */
function slicePathTemplate(template: string) {
  const [prefix, suffix] = template.split(INDEX_PLACEHOLDER);
  return {
    pathPrefix: prefix.slice(0, -1),
    pathSuffix: `{index}${suffix}`,
  };
}

function getNextAccountIdsWithAccountDerivation(
  accountDerivation: DBAccountDerivation,
  index: number,
  purpose: string,
  coinType: string,
) {
  const { template, accounts } = accountDerivation;
  let nextId = index;
  const impl = getImplByCoinType(coinType);
  const containPath = (accountIndex: number) => {
    let path: string;
    if ([IMPL_EVM, IMPL_SOL].includes(impl)) {
      path = template.replace(INDEX_PLACEHOLDER, accountIndex.toString());
    } else {
      path = getPath(purpose, coinType, accountIndex);
    }
    return accounts.find((account) => {
      const accountIdPath = account.split(SEPERATOR)[1];
      return path === accountIdPath;
    });
  };
  while (containPath(nextId)) {
    nextId += 1;
  }

  console.log('final nextId is : ', nextId);
  return nextId;
}

function getNextAccountId(
  nextAccountIds: Record<string, number> | undefined,
  template?: string,
) {
  if (!nextAccountIds || !template) {
    return 0;
  }
  return nextAccountIds?.[template] ?? 0;
}

// Get UTXO account last account id
function getLastAccountId(wallet: Wallet, impl: string, template: string) {
  const { category } = getAccountNameInfoByTemplate(impl, template);
  const nextAccountId = getNextAccountId(wallet.nextAccountIds, template);
  if (typeof nextAccountId !== 'undefined' && nextAccountId > 0) {
    const lastAccountId = `${wallet.id}${SEPERATOR}m/${category}/${
      nextAccountId - 1
    }'`;
    return lastAccountId;
  }

  return null;
}

function getAccountDerivationPrimaryKey({
  walletId,
  impl,
  template,
}: {
  walletId: string;
  impl: string;
  template: string;
}) {
  return `${walletId}-${impl}-${template}`;
}

function parsePath(impl: string, path: string, template?: string) {
  const accountNameInfo = template
    ? getAccountNameInfoByTemplate(impl, template)
    : getDefaultAccountNameInfoByImpl(impl);
  const pathComponent = path.split('/');
  const purpose = Number(
    pathComponent[1].endsWith(`'`)
      ? pathComponent[1].slice(0, -1)
      : pathComponent[1],
  );
  const pathComponentAccountIndex = accountNameInfo.template
    ?.split('/')
    .findIndex((x: string) => x.startsWith(INDEX_PLACEHOLDER));
  const accountIndex = pathComponent[pathComponentAccountIndex ?? 0].replace(
    /'$/,
    '',
  );
  return {
    accountIndex: parseInt(accountIndex, 10),
    purpose,
    coinType: accountNameInfo.coinType,
    template: accountNameInfo.template,
  };
}

export {
  getPath,
  parsePath,
  getDefaultPurpose,
  derivationPathTemplates,
  slicePathTemplate,
  getNextAccountId,
  getNextAccountIdsWithAccountDerivation,
  getLastAccountId,
  getAccountDerivationPrimaryKey,
};
