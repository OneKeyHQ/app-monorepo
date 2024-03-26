/* eslint-disable spellcheck/spell-checker */
import { isNil } from 'lodash';

import type { EAddressEncodings } from '@onekeyhq/core/src/types';
import type {
  IDBAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';

import { INDEX_PLACEHOLDER, SEPERATOR } from '../engine/engineConsts';

import networkUtils from './networkUtils';

function getWalletIdFromAccountId({ accountId }: { accountId: string }) {
  /*
  external--60--0xf588ff00613814c3f86efc57059121c74eb237f1
  hd-1--m/44'/118'/0'/0/0
  hw-da2fb055-f3c8-4b55-922e-a04a6fea29cf--m/44'/0'/0'
  hw-f5f9b539-2879-4811-bac2-8d143b08adef-mg2PbFeAMoms9Z7f5by1MscdP3RAhbrLUJ--m/49'/0'/0'
  */
  return accountId.split(SEPERATOR)[0] || '';
}

function beautifyPathTemplate({ template }: { template: string }) {
  return template.replace(INDEX_PLACEHOLDER, '*');
}

function shortenAddress({
  address,
  minLength = 14,
  leadingLength = 8,
  trailingLength = 6,
}: {
  address: string | undefined;
  leadingLength?: number;
  trailingLength?: number;
  minLength?: number;
}) {
  if (!address) {
    return '';
  }
  if (address.length <= minLength) {
    return address;
  }
  return `${address.slice(0, leadingLength)}...${address.slice(
    -trailingLength,
  )}`;
}

function isHdWallet({ walletId }: { walletId: string | undefined }) {
  return Boolean(walletId && walletId.startsWith(`${WALLET_TYPE_HD}-`));
}

function isHwWallet({ walletId }: { walletId: string | undefined }) {
  return Boolean(walletId && walletId.startsWith(`${WALLET_TYPE_HW}-`));
}

function isHwHiddenWallet({ wallet }: { wallet: IDBWallet | undefined }) {
  return (
    wallet &&
    isHwWallet({ walletId: wallet.id }) &&
    Boolean(wallet.passphraseState)
  );
}

function isImportedWallet({ walletId }: { walletId: string | undefined }) {
  return walletId === WALLET_TYPE_IMPORTED;
}

function isWatchingWallet({ walletId }: { walletId: string | undefined }) {
  return walletId === WALLET_TYPE_WATCHING;
}

function isExternalWallet({ walletId }: { walletId: string | undefined }) {
  return walletId === WALLET_TYPE_EXTERNAL;
}

function isHdAccount({ accountId }: { accountId: string }) {
  const walletId = getWalletIdFromAccountId({ accountId });
  return isHdWallet({ walletId });
}

function isHwAccount({ accountId }: { accountId: string }) {
  const walletId = getWalletIdFromAccountId({ accountId });
  return isHwWallet({ walletId });
}

function buildWatchingAccountId({
  coinType,
  address,
  xpub,
  addressEncoding,
}: {
  coinType: string;
  address?: string;
  xpub?: string;
  addressEncoding?: EAddressEncodings | undefined;
}) {
  const publicKey = xpub || address;
  if (!publicKey) {
    throw new Error('buildWatchingAccountId ERROR: publicKey is not defined');
  }
  let id = `${WALLET_TYPE_WATCHING}--${coinType}--${publicKey}`;
  if (addressEncoding) {
    id += `--${addressEncoding}`;
  }
  return id;
}

function buildImportedAccountId({
  coinType,
  pub,
  xpub,
  addressEncoding,
}: {
  coinType: string;
  pub?: string;
  xpub?: string;
  addressEncoding?: EAddressEncodings | undefined;
}) {
  const publicKey = xpub || pub;
  if (!publicKey) {
    throw new Error('buildImportedAccountId ERROR: publicKey is not defined');
  }
  let id = `${WALLET_TYPE_IMPORTED}--${coinType}--${publicKey}`;
  if (addressEncoding) {
    id += `--${addressEncoding}`;
  }
  return id;
}

function isExternalAccount({ accountId }: { accountId: string }) {
  const walletId = getWalletIdFromAccountId({ accountId });
  return isExternalWallet({ walletId });
}

function buildHDAccountId({
  walletId,
  path,
  template,
  index,
  idSuffix,
  isUtxo,
}: {
  walletId: string;
  path?: string;
  template?: string;
  index?: number;
  idSuffix?: string;
  isUtxo?: boolean;
}): string {
  let usedPath = path;
  if (!usedPath) {
    if (!template) {
      throw new Error(
        'buildHDAccountId ERROR: template or path must be provided',
      );
    }
    if (isNil(index)) {
      throw new Error('buildHDAccountId ERROR: index must be provided');
    }
    usedPath = template.replace(INDEX_PLACEHOLDER, index.toString());
  }
  let id = `${walletId}--${usedPath}`;
  // EVM LedgerLive ID:  hd-1--m/44'/60'/0'/0/0--LedgerLive
  if (idSuffix) {
    id = `${walletId}--${usedPath}--${idSuffix}`;
  }
  // utxo always remove last 0/0
  if (isUtxo) {
    id = id.replace(/\/0\/0$/i, '');
  }
  return id;
}

function buildIndexedAccountId({
  walletId,
  index,
}: {
  walletId: string;
  index: number;
}) {
  return `${walletId}--${index}`;
}

function parseIndexedAccountId({
  indexedAccountId,
}: {
  indexedAccountId: string;
}) {
  const arr = indexedAccountId.split(SEPERATOR);
  const index = Number(arr[arr.length - 1]);
  const walletIdArr = arr.slice(0, -1);
  return {
    walletId: walletIdArr.join(''),
    index,
  };
}

function buildHdWalletId({ nextHD }: { nextHD: number }) {
  return `${WALLET_TYPE_HD}-${nextHD}`;
}

function getDeviceIdFromWallet({ walletId }: { walletId: string }) {
  return walletId.replace(`${WALLET_TYPE_HW}-`, '');
}

function buildLocalTokenId({
  networkId,
  tokenIdOnNetwork,
}: {
  networkId: string;
  tokenIdOnNetwork: string;
}) {
  return `${networkId}__${tokenIdOnNetwork}`;
}

function buildLocalHistoryId(params: {
  networkId: string;
  txid: string;
  accountId: string;
}) {
  const { networkId, txid, accountId } = params;
  const historyId = `${networkId}_${txid}_${accountId}`;
  return historyId;
}

function isAccountCompatibleWithNetwork({
  account,
  networkId,
}: {
  account: IDBAccount;
  networkId: string;
}) {
  if (!networkId) {
    throw new Error(
      'isAccountCompatibleWithNetwork ERROR: networkId is not defined',
    );
  }

  const impl = networkUtils.getNetworkImpl({ networkId });
  // check if impl matched
  if (impl !== account.impl && account.impl) {
    return false;
  }

  // check if accountSupportNetworkId matched
  if (account.networks && account.networks.length) {
    for (const accountSupportNetworkId of account.networks) {
      if (accountSupportNetworkId === networkId) {
        return true;
      }
    }
    return false;
  }
  return true;
}

function getAccountCompatibleNetwork({
  account,
  networkId,
}: {
  account: IDBAccount;
  networkId: string | undefined;
}) {
  let accountNetworkId = networkId;

  if (networkId) {
    const activeNetworkImpl = networkUtils.getNetworkImpl({
      networkId,
    });

    // if impl not matched, use createAtNetwork
    if (activeNetworkImpl !== account.impl && account.impl) {
      accountNetworkId = account.createAtNetwork || ''; // should fallback to ''
    }
  }

  // if accountNetworkId not in account available networks, use first networkId of available networks
  if (account.networks && account.networks.length) {
    if (!accountNetworkId || !account.networks.includes(accountNetworkId)) {
      [accountNetworkId] = account.networks;
    }
  }
  return accountNetworkId || undefined;
}

function isOthersWallet({ walletId }: { walletId: string }) {
  if (!walletId) {
    return false;
  }
  return (
    walletId === WALLET_TYPE_WATCHING ||
    walletId === WALLET_TYPE_EXTERNAL ||
    walletId === WALLET_TYPE_IMPORTED
  );
}

function buildHwWalletId({
  dbDeviceId,
  passphraseState,
}: {
  dbDeviceId: string;
  passphraseState?: string;
}) {
  let dbWalletId = `hw-${dbDeviceId}`;
  if (passphraseState) {
    dbWalletId = `hw-${dbDeviceId}-${passphraseState}`;
  }
  return dbWalletId;
}

function buildExternalAccountId({
  wcSessionTopic,
}: {
  wcSessionTopic: string;
}) {
  const accountId = `${WALLET_TYPE_EXTERNAL}--wc--${wcSessionTopic}`;
  // accountId = `${WALLET_TYPE_EXTERNAL}--injected--${walletKey}`;
  return accountId;
}

export default {
  buildImportedAccountId,
  buildWatchingAccountId,
  buildLocalTokenId,
  buildLocalHistoryId,
  buildHdWalletId,
  buildHDAccountId,
  buildIndexedAccountId,
  buildHwWalletId,
  buildExternalAccountId,
  isHdWallet,
  isHwWallet,
  isHwHiddenWallet,
  isWatchingWallet,
  isImportedWallet,
  isExternalWallet,
  isHdAccount,
  isHwAccount,
  isExternalAccount,
  parseIndexedAccountId,
  shortenAddress,
  beautifyPathTemplate,
  getDeviceIdFromWallet,
  getWalletIdFromAccountId,
  isAccountCompatibleWithNetwork,
  getAccountCompatibleNetwork,
  isOthersWallet,
};
