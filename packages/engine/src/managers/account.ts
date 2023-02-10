import { isEmpty } from 'lodash';

import { SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../errors';
import { AccountType } from '../types/account';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '../types/wallet';

import { isCoinTypeCompatibleWithImpl } from './impl';
import { parseNetworkId } from './network';

import type { Account } from '../types/account';

function getCoinTypeFromAccountId(accountId: string): string {
  if (
    accountId.startsWith(WALLET_TYPE_IMPORTED) ||
    accountId.startsWith(WALLET_TYPE_EXTERNAL) ||
    accountId.startsWith(WALLET_TYPE_WATCHING)
  ) {
    const [walletType, coinType, address] = accountId.split(SEPERATOR);
    if (walletType && coinType && address) {
      return coinType;
    }
  } else if (
    accountId.startsWith(WALLET_TYPE_HD) ||
    accountId.startsWith(WALLET_TYPE_HW)
  ) {
    const [walletId, path] = accountId.split(SEPERATOR);
    if (walletId && path) {
      const [master, purpose, coinType] = path.split('/');
      if (master === 'm' && purpose && coinType.endsWith("'")) {
        return coinType.slice(0, -1);
      }
    }
  }
  throw new OneKeyInternalError(`Invalid accountId ${accountId}.`);
}

function getWalletIdFromAccountId(accountId: string): string {
  const walletId = accountId.split(SEPERATOR, 1)[0];
  if (walletId !== accountId) {
    return walletId;
  }
  throw new OneKeyInternalError(`Invalid accountId ${accountId}.`);
}

function getWalletTypeFromAccountId(accountId: string): string {
  const walletType = accountId?.split('-')?.[0];
  if (walletType) {
    return walletType;
  }
  throw new OneKeyInternalError(`Invalid accountId ${accountId}.`);
}

function isAccountCompatibleWithNetwork(accountId: string, networkId: string) {
  if (!networkId || !accountId) {
    return false;
  }
  const coinType = getCoinTypeFromAccountId(accountId);
  const { impl } = parseNetworkId(networkId);
  if (!impl) {
    return false;
  }
  return isCoinTypeCompatibleWithImpl(coinType, impl);
}

function isAccountWithAddress(account: Account) {
  if (account.type !== AccountType.VARIANT) return true;
  return !isEmpty(account.address);
}

export {
  getWalletIdFromAccountId,
  getWalletTypeFromAccountId,
  isAccountCompatibleWithNetwork,
  isAccountWithAddress,
};
