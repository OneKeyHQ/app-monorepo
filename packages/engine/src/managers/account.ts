import { SEPERATOR } from '../constants';
import { OneKeyInternalError } from '../errors';
import {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '../types/wallet';

import { isCoinTypeCompatibleWithImpl } from './impl';
import { getImplFromNetworkId } from './network';

function getCoinTypeFromAccountId(accountId: string): string {
  if (
    accountId.startsWith(WALLET_TYPE_IMPORTED) ||
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

function isAccountCompatibleWithNetwork(accountId: string, networkId: string) {
  const coinType = getCoinTypeFromAccountId(accountId);
  const impl = getImplFromNetworkId(networkId);
  return isCoinTypeCompatibleWithImpl(coinType, impl);
}

export { getWalletIdFromAccountId, isAccountCompatibleWithNetwork };
