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

import {
  COINTYPE_BTC,
  COINTYPE_ETH,
  COINTYPE_LIGHTNING,
  COINTYPE_LIGHTNING_TESTNET,
  COINTYPE_TBTC,
  IMPL_EVM,
  INDEX_PLACEHOLDER,
  SEPERATOR,
} from '../engine/engineConsts';

import networkUtils from './networkUtils';

import type { IExternalConnectionInfo } from '../../types/externalWallet.types';

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
  isUrlAccount,
}: {
  coinType: string;
  address?: string;
  xpub?: string;
  addressEncoding?: EAddressEncodings | undefined;
  isUrlAccount?: boolean;
}) {
  if (isUrlAccount) {
    return `${WALLET_TYPE_WATCHING}--global-url-account`;
  }
  const pubOrAddress = xpub || address;
  if (!pubOrAddress) {
    throw new Error('buildWatchingAccountId ERROR: publicKey is not defined');
  }
  let id = `${WALLET_TYPE_WATCHING}--${coinType}--${pubOrAddress}`;
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

function parseAccountId({ accountId }: { accountId: string }) {
  const arr = accountId.split(SEPERATOR);
  return {
    walletId: arr[0],
    usedPath: arr[1],
    idSuffix: arr[2],
  };
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
      accountNetworkId = account.networks?.[0];
    }
  }

  // recheck new networkId impl matched
  if (accountNetworkId && account.impl) {
    if (
      account.impl !==
      networkUtils.getNetworkImpl({ networkId: accountNetworkId })
    ) {
      accountNetworkId = undefined;
    }
  }

  if (
    accountNetworkId &&
    !networkUtils.parseNetworkId({ networkId: accountNetworkId }).chainId
  ) {
    throw new Error(
      `getAccountCompatibleNetwork ERROR: chainId not found in networkId: ${accountNetworkId}` ||
        '',
    );
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

function getWalletConnectMergedNetwork({ networkId }: { networkId: string }): {
  isMergedNetwork: boolean;
  networkIdOrImpl: string;
} {
  const impl = networkUtils.getNetworkImpl({ networkId });
  if ([IMPL_EVM].includes(impl)) {
    return {
      isMergedNetwork: true,
      networkIdOrImpl: impl,
    };
  }
  return {
    isMergedNetwork: false,
    networkIdOrImpl: networkId,
  };
}

function buildExternalAccountId({
  wcSessionTopic,
  connectionInfo,
  networkId,
}: {
  wcSessionTopic: string | undefined;
  connectionInfo: IExternalConnectionInfo | undefined;
  networkId?: string;
}) {
  let accountId = '';
  // eslint-disable-next-line no-param-reassign
  wcSessionTopic = wcSessionTopic || connectionInfo?.walletConnect?.topic;
  if (wcSessionTopic) {
    if (!networkId) {
      throw new Error(
        'buildExternalAccountId ERROR: walletconnect account required networkId ',
      );
    }
    const { networkIdOrImpl } = getWalletConnectMergedNetwork({
      networkId,
    });
    const suffix = networkIdOrImpl;

    accountId = `${WALLET_TYPE_EXTERNAL}--wc--${wcSessionTopic}--${suffix}`;
  }
  if (connectionInfo?.evmEIP6963?.info?.rdns) {
    accountId = `${WALLET_TYPE_EXTERNAL}--${COINTYPE_ETH}--eip6963--${connectionInfo?.evmEIP6963?.info?.rdns}`;
  }
  if (connectionInfo?.evmInjected?.global) {
    accountId = `${WALLET_TYPE_EXTERNAL}--${COINTYPE_ETH}--injected--${connectionInfo?.evmInjected?.global}`;
  }
  if (!accountId) {
    throw new Error('buildExternalAccountId ERROR: accountId is empty');
  }
  // accountId = `${WALLET_TYPE_EXTERNAL}--injected--${walletKey}`;
  return accountId;
}

// m/84'/0'/0' -> m/44'/81297820149147'/0'
function buildBtcToLnPath({
  path,
  isTestnet,
}: {
  path: string;
  isTestnet: boolean;
}) {
  // purpose 84' -> 44'
  let transformedPath = path.replace(/84'/, "44'");
  const targetCoinType = isTestnet ? COINTYPE_TBTC : COINTYPE_BTC;
  const replacementCoinType = isTestnet
    ? COINTYPE_LIGHTNING_TESTNET
    : COINTYPE_LIGHTNING;
  transformedPath = transformedPath.replace(
    new RegExp(`(^m/44'/${targetCoinType})'`, 'g'),
    `m/44'/${replacementCoinType}'`,
  );
  return transformedPath;
}

// m/44'/81297820149147'/0' -> m/84'/0'/0'
function buildLnToBtcPath({
  path,
  isTestnet,
}: {
  path: string;
  isTestnet: boolean;
}) {
  // purpose 44' -> 84'
  let transformedPath = path.replace(/44'/, "84'");
  const targetCoinType = isTestnet
    ? COINTYPE_LIGHTNING_TESTNET
    : COINTYPE_LIGHTNING;
  const replacementCoinType = isTestnet ? COINTYPE_TBTC : COINTYPE_BTC;
  transformedPath = transformedPath.replace(
    new RegExp(`(^m/84'/${targetCoinType})'`, 'g'),
    `m/84'/${replacementCoinType}'`,
  );
  return transformedPath;
}

// hd-1--m/84'/0'/0' -> hd-1--m/44'/81297820149147'/0'
function buildLightningAccountId({
  accountId,
  isTestnet,
}: {
  accountId: string;
  isTestnet: boolean;
}) {
  const parts = accountId.split(SEPERATOR);
  if (parts.length < 2) {
    throw new Error('buildLightningAccountId ERROR: invalid accountId');
  }
  const newPath = buildBtcToLnPath({
    path: parts[1],
    isTestnet,
  });
  return `${parts[0]}--${newPath}`;
}

function buildLightingCredentialId({ address }: { address: string }) {
  return `lighting--${address}`;
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
  parseAccountId,
  parseIndexedAccountId,
  shortenAddress,
  beautifyPathTemplate,
  getDeviceIdFromWallet,
  getWalletIdFromAccountId,
  isAccountCompatibleWithNetwork,
  getAccountCompatibleNetwork,
  isOthersWallet,
  buildBtcToLnPath,
  buildLnToBtcPath,
  buildLightningAccountId,
  buildLightingCredentialId,
  getWalletConnectMergedNetwork,
};
