/* eslint-disable spellcheck/spell-checker */
import { isNaN, isNil, isNumber } from 'lodash';

import type { EAddressEncodings } from '@onekeyhq/core/src/types';
import type {
  IDBAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_QR,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ALL_NETWORK_ACCOUNT_MOCK_ADDRESS } from '../consts/addresses';
import { AGGREGATE_TOKEN_MOCK_NETWORK_ID } from '../consts/networkConsts';
import {
  type EHyperLiquidAgentName,
  HYPERLIQUID_AGENT_CREDENTIAL_PREFIX,
} from '../consts/perp';
import {
  COINTYPE_ALLNETWORKS,
  COINTYPE_BTC,
  COINTYPE_ETH,
  COINTYPE_LIGHTNING,
  COINTYPE_LIGHTNING_TESTNET,
  COINTYPE_TBTC,
  IMPL_EVM,
  INDEX_PLACEHOLDER,
  SEPERATOR,
} from '../engine/engineConsts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { OneKeyInternalError } from '../errors';

import { generateUUID } from './miscUtils';
import networkUtils from './networkUtils';

import type { IExternalConnectionInfo } from '../../types/externalWallet.types';

function getWalletIdFromAccountId({
  accountId,
}: {
  accountId: string;
}): string {
  /*
  external--60--0xf588ff00613814c3f86efc57059121c74eb237f1
  hd-1--m/44'/118'/0'/0/0
  hw-da2fb055-f3c8-4b55-922e-a04a6fea29cf--m/44'/0'/0'
  hw-f5f9b539-2879-4811-bac2-8d143b08adef-mg2PbFeAMoms9Z7f5by1MscdP3RAhbrLUJ--m/49'/0'/0'
  */
  return accountId.split(SEPERATOR)[0] || '';
}

/**
 * m/44'/60'/x'/0/0 -> m/44'/60' for prefix, {index}/0/0 for suffix
 * @param template derivation path template
 * @returns string
 */
function slicePathTemplate(template: string): {
  pathPrefix: string;
  pathSuffix: string;
} {
  const [prefix, suffix] = template.split(INDEX_PLACEHOLDER);
  return {
    pathPrefix: prefix.slice(0, -1), // m/44'/60'
    pathSuffix: `{index}${suffix}`, // {index}/0/0
  };
}

function beautifyPathTemplate({ template }: { template: string }): string {
  return template.replace(INDEX_PLACEHOLDER, '*');
}

function normalizePathTemplate({ template }: { template: string }): string {
  return template
    .replace('*', () => INDEX_PLACEHOLDER) // replace first * with INDEX_PLACEHOLDER
    .replace(/\*/g, '0'); // replace other * with 0
}

function findIndexFromTemplate({
  template,
  path,
}: {
  template: string;
  path: string;
}): number | undefined {
  const templateItems = template.split('/');
  const pathItems = path.split('/');
  for (let i = 0; i < templateItems.length; i += 1) {
    const tplItem = templateItems[i];
    const pathItem = pathItems[i];
    if (tplItem === INDEX_PLACEHOLDER && pathItem) {
      return Number(pathItem);
    }
    if (tplItem === `${INDEX_PLACEHOLDER}'` && pathItem) {
      return Number(pathItem.replace(/'+$/, ''));
    }
  }
  return undefined;
}

function buildPathFromTemplate({
  template,
  index,
}: {
  template: string;
  index: number;
}): string {
  return normalizePathTemplate({ template }).replace(
    INDEX_PLACEHOLDER,
    index.toString(),
  );
}

function removePathLastSegment({
  path,
  removeCount,
}: {
  path: string;
  removeCount: number;
}): string {
  const arr = path.split('/');
  return arr.slice(0, -removeCount).filter(Boolean).join('/');
}

function buildUtxoAddressRelPath({
  isChange = false,
  addressIndex = 0,
}: { isChange?: boolean; addressIndex?: number } = {}) {
  const addressRelPath = `${isChange ? '1' : '0'}/${addressIndex}`;
  return addressRelPath;
}

// m/84'/0'/0' -> m/44'/81297820149147'/0'
function buildBtcToLnPath({
  path,
  isTestnet,
}: {
  path: string;
  isTestnet: boolean;
}): string {
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
}): string {
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

function formatUtxoPath(path: string): string {
  // Split the path into an array by '/'
  const parts = path.split('/');

  // Check if the path starts with 'm'
  if (parts[0] !== 'm') {
    throw new OneKeyLocalError('Invalid UTXO path: path should start with "m"');
  }

  // Check if the path has at least three hardened levels
  if (parts.length < 4) {
    throw new OneKeyLocalError(
      'Invalid UTXO path: path should have at least three hardened levels',
    );
  }

  // Check if the first three levels are hardened
  for (let i = 1; i <= 3; i += 1) {
    if (!parts[i].endsWith("'")) {
      throw new OneKeyLocalError(
        `Invalid UTXO path: level ${i} should be hardened`,
      );
    }
  }

  // Extract the first three levels and recombine them into a new path
  const newPath = parts.slice(0, 4).join('/');

  return newPath;
}

function shortenAddress({
  address,
  minLength = 14,
  leadingLength = 8,
  trailingLength = 6,
  showDot = true,
}: {
  address: string | undefined;
  leadingLength?: number;
  trailingLength?: number;
  minLength?: number;
  showDot?: boolean;
}): string {
  if (!address) {
    return '';
  }
  if (address.length <= minLength) {
    return address;
  }
  return `${address.slice(0, leadingLength)}${
    showDot ? '...' : ''
  }${address.slice(-trailingLength)}`;
}

function isHdWallet({ walletId }: { walletId: string | undefined }): boolean {
  return Boolean(walletId && walletId.startsWith(`${WALLET_TYPE_HD}-`));
}

function isQrWallet({ walletId }: { walletId: string | undefined }): boolean {
  return Boolean(walletId && walletId.startsWith(`${WALLET_TYPE_QR}-`));
}

function isHwWallet({ walletId }: { walletId: string | undefined }): boolean {
  return Boolean(walletId && walletId.startsWith(`${WALLET_TYPE_HW}-`));
}

function isHwOrQrWallet({
  walletId,
}: {
  walletId: string | undefined;
}): boolean {
  return isHwWallet({ walletId }) || isQrWallet({ walletId });
}

function isHwHiddenWallet({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}): boolean {
  return Boolean(
    wallet &&
      (isHwWallet({ walletId: wallet.id }) ||
        isQrWallet({ walletId: wallet.id })) &&
      wallet.passphraseState,
  );
}

function isImportedWallet({
  walletId,
}: {
  walletId: string | undefined;
}): boolean {
  return walletId === WALLET_TYPE_IMPORTED;
}

function isWatchingWallet({
  walletId,
}: {
  walletId: string | undefined;
}): boolean {
  return walletId === WALLET_TYPE_WATCHING;
}

function isExternalWallet({
  walletId,
}: {
  walletId: string | undefined;
}): boolean {
  return walletId === WALLET_TYPE_EXTERNAL;
}

function isHdAccount({ accountId }: { accountId: string }): boolean {
  const walletId = getWalletIdFromAccountId({ accountId });
  return isHdWallet({ walletId });
}

function isQrAccount({ accountId }: { accountId: string }): boolean {
  const walletId = getWalletIdFromAccountId({ accountId });
  return isQrWallet({ walletId });
}

function isHwAccount({ accountId }: { accountId: string }): boolean {
  const walletId = getWalletIdFromAccountId({ accountId });
  return isHwWallet({ walletId });
}

function isHwOrQrAccount({ accountId }: { accountId: string }): boolean {
  const walletId = getWalletIdFromAccountId({ accountId });
  return isHwOrQrWallet({ walletId });
}

const URL_ACCOUNT_ID = `${WALLET_TYPE_WATCHING}--global-url-account`;
function isUrlAccountFn({
  accountId,
}: {
  accountId: string | undefined;
}): boolean {
  return accountId === URL_ACCOUNT_ID;
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
}): string {
  if (isUrlAccount) {
    return URL_ACCOUNT_ID;
  }
  const pubOrAddress = xpub || address;
  if (!pubOrAddress) {
    throw new OneKeyLocalError(
      'buildWatchingAccountId ERROR: publicKey is not defined',
    );
  }
  let id = `${WALLET_TYPE_WATCHING}--${coinType}--${pubOrAddress}`;
  if (addressEncoding) {
    id += `--${addressEncoding}`;
  }
  return id;
}

function buildIndexedAccountName({ pathIndex }: { pathIndex: number }): string {
  return `Account #${pathIndex + 1}`;
}

function buildHDAccountName({
  pathIndex,
  namePrefix,
}: {
  pathIndex: number;
  // VaultSettings.accountDeriveInfo.default.namePrefix
  namePrefix: string;
}): string {
  return `${namePrefix} #${pathIndex + 1}`;
}

function buildBaseAccountName({
  mainName = 'Account',
  nextAccountId,
}: {
  mainName?: string;
  nextAccountId: number;
}): string {
  return `${mainName} #${nextAccountId}`;
}

function buildImportedAccountId({
  coinType,
  pub,
  xpub,
  addressEncoding,
  address,
}: {
  coinType: string;
  pub?: string;
  xpub?: string;
  addressEncoding?: EAddressEncodings | undefined;
  address?: string;
}): string {
  const publicKey = xpub || pub;
  if (!publicKey) {
    throw new OneKeyLocalError(
      'buildImportedAccountId ERROR: publicKey is not defined',
    );
  }
  let id = `${WALLET_TYPE_IMPORTED}--${coinType}--${publicKey}`;
  if (addressEncoding) {
    id += `--${addressEncoding}`;
  }
  if (address) {
    id += `--${address}`;
  }
  return id;
}

function isExternalAccount({ accountId }: { accountId: string }): boolean {
  const walletId = getWalletIdFromAccountId({ accountId });
  return isExternalWallet({ walletId });
}

function isWatchingAccount({ accountId }: { accountId: string }): boolean {
  const walletId = getWalletIdFromAccountId({ accountId });
  return isWatchingWallet({ walletId });
}

function isImportedAccount({ accountId }: { accountId: string }): boolean {
  const walletId = getWalletIdFromAccountId({ accountId });
  return isImportedWallet({ walletId });
}

function buildHDAccountId({
  networkImpl,
  walletId,
  path,
  template,
  index,
  idSuffix,
  isUtxo,
}: {
  networkImpl?: string;
  //
  walletId: string;
  //
  path?: string; // TODO remove path
  template?: string;
  index?: number;
  //
  idSuffix?: string;
  isUtxo?: boolean;
}): string {
  let usedPath = path;
  if (!usedPath) {
    if (!template) {
      throw new OneKeyLocalError(
        'buildHDAccountId ERROR: template or path must be provided',
      );
    }
    if (isNil(index)) {
      throw new OneKeyLocalError(
        'buildHDAccountId ERROR: index must be provided',
      );
    }
    usedPath = buildPathFromTemplate({ template, index });
  }
  let id = `${walletId}--${usedPath}`;
  // EVM LedgerLive ID:  hd-1--m/44'/60'/0'/0/0--LedgerLive
  if (idSuffix) {
    id = `${walletId}--${usedPath}--${idSuffix}`;
  }
  const isLightningNetwork = networkUtils.isLightningNetworkByImpl(networkImpl);
  // utxo and lightning network always remove last 0/0
  if (isUtxo || isLightningNetwork) {
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
}): string {
  if (index < 0) {
    throw new OneKeyLocalError(
      'buildIndexedAccountId ERROR: index must be positive',
    );
  }
  return `${walletId}--${index}`;
}

function parseAccountId({ accountId }: { accountId: string }): {
  walletId: string | undefined;
  usedPath: string | undefined;
  idSuffix: string | undefined;
} {
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
}): {
  walletId: string;
  index: number;
} {
  const arr = indexedAccountId.split(SEPERATOR);
  const index = Number(arr[arr.length - 1]);
  const walletIdArr = arr.slice(0, -1);
  return {
    walletId: walletIdArr.join(''),
    index,
  };
}

function isAllNetworkMockAccount({
  accountId,
}: {
  accountId: string;
}): boolean {
  const parsed = parseAccountId({ accountId });
  if (parsed?.usedPath) {
    const [coinType, index] = parsed.usedPath.split('/') || [];
    const r = coinType === COINTYPE_ALLNETWORKS && !Number.isNaN(Number(index));
    return r;
  }
  return false;
}

function buildAllNetworkIndexedAccountIdFromAccountId({
  accountId,
}: {
  accountId: string;
}): string {
  const { walletId, usedPath } = parseAccountId({ accountId });
  if (!usedPath) {
    throw new OneKeyLocalError(
      'buildAllNetworkIndexedAccountIdFromAccountId ERROR: usedPath is empty',
    );
  }
  if (!walletId) {
    throw new OneKeyLocalError(
      'buildAllNetworkIndexedAccountIdFromAccountId ERROR: walletId is empty',
    );
  }
  return buildIndexedAccountId({
    walletId,
    index: parseInt(usedPath.split('/')[1], 10),
  });
}

function buildHdWalletId({ nextHD }: { nextHD: number }): string {
  return `${WALLET_TYPE_HD}-${nextHD}`;
}

function getDeviceIdFromWallet({ walletId }: { walletId: string }): string {
  return walletId.replace(`${WALLET_TYPE_HW}-`, '');
}

function buildLocalTokenId({
  networkId,
  tokenIdOnNetwork,
}: {
  networkId: string;
  tokenIdOnNetwork: string;
}): string {
  return `${networkId}__${tokenIdOnNetwork}`;
}

function buildLocalHistoryId(params: {
  networkId: string;
  accountAddress: string;
  txid: string;
  xpub?: string;
  $key?: string;
}): string {
  const { networkId, txid, accountAddress, xpub, $key } = params;
  const historyId = `${networkId}_${txid}_${xpub || accountAddress}_${
    $key || ''
  }`;
  return historyId;
}

function buildAccountLocalAssetsKey({
  networkId,
  accountAddress,
  xpub,
}: {
  networkId?: string;
  accountAddress?: string;
  xpub?: string;
}): string {
  if (!accountAddress && !xpub) {
    throw new OneKeyInternalError('accountAddress or xpub is required');
  }

  if (networkId) {
    return `${networkId}_${(xpub || accountAddress) ?? ''}`.toLowerCase();
  }

  return `${(xpub || accountAddress) ?? ''}`.toLowerCase();
}

function isAccountCompatibleWithNetwork({
  account,
  networkId,
}: {
  account: IDBAccount;
  networkId: string;
}): boolean {
  if (!networkId) {
    throw new OneKeyLocalError(
      'isAccountCompatibleWithNetwork ERROR: networkId is not defined',
    );
  }

  if (networkId === AGGREGATE_TOKEN_MOCK_NETWORK_ID) {
    return true;
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
}): string | undefined {
  let accountNetworkId = networkId || account.createAtNetwork;

  if (networkUtils.isAllNetwork({ networkId: accountNetworkId })) {
    return accountNetworkId;
  }

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

  // recheck chainId available
  if (
    accountNetworkId &&
    !networkUtils.parseNetworkId({ networkId: accountNetworkId }).chainId
  ) {
    throw new OneKeyLocalError(
      `getAccountCompatibleNetwork ERROR: chainId not found in networkId: ${accountNetworkId}` ||
        '',
    );
  }

  return accountNetworkId || undefined;
}

function isOthersWallet({ walletId }: { walletId: string }): boolean {
  if (!walletId) {
    return false;
  }
  return (
    walletId === WALLET_TYPE_WATCHING ||
    walletId === WALLET_TYPE_EXTERNAL ||
    walletId === WALLET_TYPE_IMPORTED
  );
}

function isOthersAccount({
  accountId,
}: {
  accountId: string | undefined;
}): boolean {
  if (!accountId) {
    return false;
  }
  const walletId = getWalletIdFromAccountId({ accountId });
  return isOthersWallet({ walletId });
}

function buildHwWalletId({
  dbDeviceId,
  passphraseState,
}: {
  dbDeviceId: string;
  passphraseState?: string;
}): string {
  let dbWalletId = `hw-${dbDeviceId}`;
  if (passphraseState) {
    dbWalletId = `hw-${dbDeviceId}-${passphraseState}`;
  }
  return dbWalletId;
}

function buildQrWalletId({
  dbDeviceId,
  xfpHash,
}: {
  dbDeviceId: string;
  xfpHash: string;
}): string {
  let dbWalletId = `qr-${dbDeviceId}`;

  // hidden wallet pass xfpHash
  if (xfpHash) {
    dbWalletId = `qr-${dbDeviceId}-${xfpHash}`;
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
}): string {
  let accountId = '';
  // eslint-disable-next-line no-param-reassign
  wcSessionTopic = wcSessionTopic || connectionInfo?.walletConnect?.topic;
  if (wcSessionTopic) {
    if (!networkId) {
      throw new OneKeyLocalError(
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
    throw new OneKeyLocalError(
      'buildExternalAccountId ERROR: accountId is empty',
    );
  }
  // accountId = `${WALLET_TYPE_EXTERNAL}--injected--${walletKey}`;
  return accountId;
}

// hd-1--m/84'/0'/0' -> hd-1--m/44'/81297820149147'/0'
function buildLightningAccountId({
  accountId,
  isTestnet,
}: {
  accountId: string;
  isTestnet: boolean;
}): string {
  const parts = accountId.split(SEPERATOR);
  if (parts.length < 2) {
    throw new OneKeyLocalError(
      'buildLightningAccountId ERROR: invalid accountId',
    );
  }
  const newPath = buildBtcToLnPath({
    path: parts[1],
    isTestnet,
  });
  return `${parts[0]}--${newPath}`;
}

// buildDeviceName() move to deviceUtils.buildDeviceName()
function buildDeviceDbId() {
  return generateUUID();
}

function buildHiddenWalletName({
  parentWallet,
}: {
  parentWallet: IDBWallet | undefined;
}): string {
  return `Hidden #${parentWallet?.nextIds?.hiddenWalletNum || 1}`;
}

function buildTonMnemonicCredentialId({
  accountId,
}: {
  accountId: string;
}): string {
  return `${accountId}--ton_credential`;
}

function isTonMnemonicCredentialId(credentialId: string): boolean {
  return credentialId.endsWith('--ton_credential');
}

function getAccountIdFromTonMnemonicCredentialId({
  credentialId,
}: {
  credentialId: string;
}): string {
  return credentialId.replace(/--ton_credential$/, '');
}

function buildHyperLiquidAgentCredentialId({
  userAddress,
  agentName,
}: {
  userAddress: string;
  agentName: EHyperLiquidAgentName;
}): string {
  if (!userAddress) {
    throw new OneKeyLocalError(
      'buildHyperLiquidAgentCredentialId ERROR: userAddress is required',
    );
  }
  return `${HYPERLIQUID_AGENT_CREDENTIAL_PREFIX}--${userAddress}--${agentName}`;
}

function buildCustomEvmNetworkId({ chainId }: { chainId: string }): string {
  return `evm--${chainId}`;
}

function buildAccountValueKey({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}): string {
  return `${accountId}_${networkId}`;
}

function parseAccountValueKey({ key }: { key: string }): {
  accountId: string;
  networkId: string;
} {
  const [accountId, networkId] = key.split('_');
  return {
    accountId,
    networkId,
  };
}

function isAllNetworkMockAddress({ address }: { address?: string }): boolean {
  return address === ALL_NETWORK_ACCOUNT_MOCK_ADDRESS;
}

function isValidWalletXfp({ xfp }: { xfp: string | undefined }): boolean {
  return Boolean(xfp && xfp.length > 8 && xfp.includes('--'));
}

function buildFullXfp({
  xfp,
  firstTaprootXpub,
}: {
  xfp: string;
  firstTaprootXpub: string;
}): string | undefined {
  if (!xfp || !firstTaprootXpub) {
    return undefined;
  }
  return `${xfp.toLowerCase()}--${firstTaprootXpub}`;
}

function getShortXfp({ xfp }: { xfp: string }): string {
  return xfp.split('--')[0];
}

function getHDAccountPathIndex({
  account,
}: {
  account: {
    pathIndex: number | undefined;
    indexedAccountId: string | undefined;
    template: string | undefined;
    path: string | undefined;
  };
}): number | undefined {
  let index = account.pathIndex;
  if (isNil(index) && account.indexedAccountId) {
    index = parseIndexedAccountId({
      indexedAccountId: account.indexedAccountId,
    }).index;
  }
  if (isNil(index) && account.template && account.path) {
    index = findIndexFromTemplate({
      template: account.template,
      path: account.path,
    });
  }
  return isNumber(index) && !isNaN(index) ? index : undefined;
}

function getBTCFreshAddressKey({
  networkId,
  xpubSegwit,
}: {
  networkId: string;
  xpubSegwit: string;
}): string {
  if (!xpubSegwit) {
    throw new OneKeyLocalError('xpubSegwit is required');
  }
  return `${networkId}__${xpubSegwit}`;
}

function isEnabledBtcFreshAddress({
  accountId,
  walletId,
  networkId,
  enableBTCFreshAddress,
}: {
  accountId?: string | undefined;
  walletId?: string | undefined;
  networkId?: string | undefined;
  enableBTCFreshAddress?: boolean | undefined;
}): boolean {
  if (!networkUtils.isBTCNetwork(networkId)) {
    return false;
  }
  if (!enableBTCFreshAddress) {
    return false;
  }
  if (accountId) {
    return isHdAccount({ accountId }) || isHwAccount({ accountId });
  }
  if (walletId) {
    return isHdWallet({ walletId }) || isHwWallet({ walletId });
  }
  return false;
}

function buildKeylessWalletId({
  sharePackSetId,
}: {
  sharePackSetId: string;
}): string {
  return `${WALLET_TYPE_HD}-keyless-${sharePackSetId}`;
}

function isKeylessWallet({
  walletId,
}: {
  walletId: string | undefined | null;
}): boolean {
  return Boolean(
    walletId && walletId?.startsWith(`${WALLET_TYPE_HD}-keyless-`),
  );
}

function getKeylessWalletPackSetId({ walletId }: { walletId: string }): string {
  const packSetId = walletId.split(`${WALLET_TYPE_HD}-keyless-`)[1];
  if (!packSetId) {
    throw new OneKeyLocalError(
      'getKeylessWalletPackSetId ERROR: packSetId is empty',
    );
  }
  return packSetId;
}

function buildKeylessDevicePackKey({
  packSetId,
}: {
  packSetId: string;
}): string {
  return `OneKey_Keyless__${packSetId}`;
}

function isValidDeriveType(deriveType: string): boolean {
  if (!deriveType) return false;
  const validDeriveTypes: Record<IAccountDeriveTypes, true> = {
    default: true,
    ledgerLive: true,
    BIP86: true,
    BIP84: true,
    BIP44: true,
    kaspaOfficial: true,
  } as const satisfies Record<IAccountDeriveTypes, true>;
  return (
    (validDeriveTypes[deriveType as IAccountDeriveTypes] ?? false) === true
  );
}

export default {
  URL_ACCOUNT_ID,
  HYPERLIQUID_AGENT_CREDENTIAL_PREFIX,

  getKeylessWalletPackSetId,
  buildKeylessDevicePackKey,
  buildKeylessWalletId,
  buildAccountValueKey,
  parseAccountValueKey,
  buildUtxoAddressRelPath,
  buildBaseAccountName,
  buildHDAccountName,
  buildIndexedAccountName,
  buildImportedAccountId,
  buildWatchingAccountId,
  buildLocalTokenId,
  buildLocalHistoryId,
  buildHdWalletId,
  buildHDAccountId,
  buildIndexedAccountId,
  buildHwWalletId,
  buildQrWalletId,
  buildExternalAccountId,
  buildAllNetworkIndexedAccountIdFromAccountId,

  isKeylessWallet,
  isHdWallet,
  isQrWallet,
  isHwWallet,
  isHwOrQrWallet,
  isHwHiddenWallet,
  isWatchingWallet,
  isImportedWallet,
  isExternalWallet,
  isHdAccount,
  isHwAccount,
  isQrAccount,
  isHwOrQrAccount,
  isExternalAccount,
  isWatchingAccount,
  isImportedAccount,
  isAllNetworkMockAccount,
  isAllNetworkMockAddress,
  isAccountCompatibleWithNetwork,
  isOthersWallet,
  isOthersAccount,
  isUrlAccountFn,
  isTonMnemonicCredentialId,
  isValidWalletXfp,
  isEnabledBtcFreshAddress,
  isValidDeriveType,

  parseAccountId,
  parseIndexedAccountId,
  shortenAddress,
  slicePathTemplate,
  beautifyPathTemplate,
  getDeviceIdFromWallet,
  getWalletIdFromAccountId,
  getAccountCompatibleNetwork,
  buildBtcToLnPath,
  buildLnToBtcPath,
  buildLightningAccountId,
  buildDeviceDbId,
  getWalletConnectMergedNetwork,
  formatUtxoPath,
  buildPathFromTemplate,
  findIndexFromTemplate,
  getHDAccountPathIndex,
  removePathLastSegment,
  buildHiddenWalletName,
  buildAccountLocalAssetsKey,
  buildTonMnemonicCredentialId,
  getAccountIdFromTonMnemonicCredentialId,
  buildHyperLiquidAgentCredentialId,
  buildCustomEvmNetworkId,
  buildFullXfp,
  getShortXfp,
  getBTCFreshAddressKey,
};
