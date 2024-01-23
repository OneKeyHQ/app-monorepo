/* eslint-disable spellcheck/spell-checker */
import { isNil } from 'lodash';

import {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
} from '@onekeyhq/kit-bg/src/dbs/local/consts';

import { EAccountSelectorSceneName } from '../../types';
import { INDEX_PLACEHOLDER, SEPERATOR } from '../engine/engineConsts';

import uriUtils from './uriUtils';

function beautifyPathTemplate({ template }: { template: string }) {
  return template.replace(INDEX_PLACEHOLDER, '*');
}

function shortenAddress({ address }: { address: string }) {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function isHdWallet({ walletId }: { walletId: string }) {
  return walletId.startsWith(`${WALLET_TYPE_HD}-`);
}
function isHwWallet({ walletId }: { walletId: string }) {
  return walletId.startsWith(`${WALLET_TYPE_HW}-`);
}

function buildHDAccountId({
  walletId,
  index,
  template,
  path,
  idSuffix,
  isUtxo,
}: {
  walletId: string;
  index?: number;
  template?: string;
  path?: string;
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
  if (isUtxo) {
    id = id.replace(/\/0\/0$/i, '');
  }
  return id;
}

function buildAccountSelectorSceneId({
  sceneName,
  sceneUrl,
}: {
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
}): string {
  if (sceneName === EAccountSelectorSceneName.discover) {
    if (!sceneUrl) {
      throw new Error('buildSceneId ERROR: sceneUrl is required');
    }
    const origin = uriUtils.getOriginFromUrl({ url: sceneUrl });
    if (origin !== sceneUrl) {
      throw new Error('sceneUrl should be origin not full url');
    }
    return `${sceneName}--${origin}`;
  }
  return sceneName;
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

function getWalletIdFromAccountId({ accountId }: { accountId: string }) {
  /*
  external--60--0xf588ff00613814c3f86efc57059121c74eb237f1
  hd-1--m/44'/118'/0'/0/0
  hw-da2fb055-f3c8-4b55-922e-a04a6fea29cf--m/44'/0'/0'
  hw-f5f9b539-2879-4811-bac2-8d143b08adef-mg2PbFeAMoms9Z7f5by1MscdP3RAhbrLUJ--m/49'/0'/0'
  */
  return accountId.split(SEPERATOR)[0] || '';
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

export default {
  buildLocalTokenId,
  buildHdWalletId,
  isHdWallet,
  isHwWallet,
  buildHDAccountId,
  buildIndexedAccountId,
  parseIndexedAccountId,
  shortenAddress,
  beautifyPathTemplate,
  buildAccountSelectorSceneId,
  getDeviceIdFromWallet,
  getWalletIdFromAccountId,
};
