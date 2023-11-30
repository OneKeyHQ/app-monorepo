import { isNil } from 'lodash';

import { WALLET_TYPE_HD } from '@onekeyhq/kit-bg/src/dbs/local/consts';

import { INDEX_PLACEHOLDER } from '../engine/engineConsts';

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

function buildHDAccountId({
  walletId,
  index,
  template,
  path,
  idSuffix,
}: {
  walletId: string;
  index?: number;
  template?: string;
  path?: string;
  idSuffix?: string;
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
  return id;
}

export default {
  isHdWallet,
  buildHDAccountId,
  shortenAddress,
  beautifyPathTemplate,
};
