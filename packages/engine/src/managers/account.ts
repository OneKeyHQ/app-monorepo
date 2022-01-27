import { IMPL_EVM, SEPERATOR } from '../constants';
import { NotImplemented, OneKeyInternalError } from '../errors';
import {
  ACCOUNT_TYPE_MULADDR,
  ACCOUNT_TYPE_SIMPLE,
  Account,
  DBAccount,
  DBMulAddrAccount,
  DBSimpleAccount,
} from '../types/account';
import {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '../types/wallet';

import { implToCoinTypes, isCoinTypeCompatibleWithImpl } from './impl';
import { getImplFromNetworkId } from './network';

function fromDBAccountToAccount(dbAccount: DBAccount): Account {
  const { type } = dbAccount;
  const base = {
    id: dbAccount.id,
    name: dbAccount.name,
    type,
    path: dbAccount.path,
    coinType: dbAccount.coinType,
    tokens: [],
  };
  if (type === ACCOUNT_TYPE_SIMPLE) {
    return Object.assign(base, {
      pub: (dbAccount as DBSimpleAccount).pub,
      address: (dbAccount as DBSimpleAccount).address,
    });
  }
  if (type === ACCOUNT_TYPE_MULADDR) {
    return Object.assign(base, {
      xpub: (dbAccount as DBMulAddrAccount).xpub,
      addresses: new Map(
        Object.entries((dbAccount as DBMulAddrAccount).addresses),
      ),
    });
  }
  throw new OneKeyInternalError('Unsupported account type.');
}

function getHDAccountToAdd(
  impl: string,
  walletId: string,
  path: string,
  xpub: Buffer,
  name?: string,
): DBAccount {
  const coinType = implToCoinTypes[impl];
  if (typeof coinType === 'undefined') {
    throw new OneKeyInternalError(`Unsupported implementation ${impl}.`);
  }
  return {
    id: `${walletId}--${path}`,
    name: name || '',
    type: 'simple',
    path,
    coinType,
    pub: xpub.slice(-33).toString('hex'),
    address: '',
  };
}

function getWatchingAccountToCreate(
  impl: string,
  target: string,
  name?: string,
): DBAccount {
  if (impl !== IMPL_EVM) {
    throw new OneKeyInternalError(`Unsupported implementation ${impl}.`);
  }
  return {
    id: `watching--60--${target}`,
    name: name || '',
    type: 'simple', // TODO: other implementations.
    path: '',
    coinType: '60',
    pub: '', // TODO: only address is supported for now.
    address: target,
  };
}

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
  return isCoinTypeCompatibleWithImpl(
    getCoinTypeFromAccountId(accountId),
    getImplFromNetworkId(networkId),
  );
}

function buildGetBalanceRequestsRaw(
  address: string,
  tokenIds: Array<string>,
  withMain = true,
): Array<{ address: string; coin: { tokenAddress?: string } }> {
  return (withMain ? [{ address, coin: {} }] : []).concat(
    tokenIds.map((tokenId) => ({ address, coin: { tokenAddress: tokenId } })),
  );
}

function buildGetBalanceRequest(
  dbAccount: DBAccount | undefined,
  tokenIds: Array<string>,
  withMain = true,
): Array<{ address: string; coin: { tokenAddress?: string } }> {
  if (typeof dbAccount === 'undefined') {
    throw new OneKeyInternalError('Account not found.');
  }
  if (dbAccount.type !== ACCOUNT_TYPE_SIMPLE) {
    throw new NotImplemented();
  }
  return buildGetBalanceRequestsRaw(
    (dbAccount as DBSimpleAccount).address,
    tokenIds,
    withMain,
  );
}

export {
  fromDBAccountToAccount,
  getHDAccountToAdd,
  getWatchingAccountToCreate,
  getWalletIdFromAccountId,
  isAccountCompatibleWithNetwork,
  buildGetBalanceRequestsRaw,
  buildGetBalanceRequest,
};
