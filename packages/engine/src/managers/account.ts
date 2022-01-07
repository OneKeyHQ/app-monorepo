import BigNumber from 'bignumber.js';

import { BaseClient } from '@onekeyhq/blockchain-libs/dist/provider/abc';

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

import { isCoinTypeCompatibleWithImpl } from './impl';
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
      const [master, purpose, coinType] = accountId.split(SEPERATOR);
      if (master === 'm' && purpose && coinType.endsWith("'")) {
        return coinType.slice(0, -1);
      }
    }
  }
  throw new OneKeyInternalError(`Invalid accountId ${accountId}.`);
}

function isAccountCompatibleWithNetwork(accountId: string, networkId: string) {
  return isCoinTypeCompatibleWithImpl(
    getCoinTypeFromAccountId(accountId),
    getImplFromNetworkId(networkId),
  );
}

function getAccountBalance(
  client: BaseClient,
  address: string,
  tokenIds: Array<string>,
  withMain = true,
): Promise<Array<BigNumber | undefined>> {
  const requests = (withMain ? [{ address, coin: {} }] : []).concat(
    tokenIds.map((tokenId) => ({ address, coin: { tokenAddress: tokenId } })),
  );
  return client.getBalances(requests);
}

function getDBAccountBalance(
  client: BaseClient,
  dbAccount: DBAccount | undefined,
  tokenIds: Array<string>,
  withMain = true,
): Promise<Array<BigNumber | undefined>> {
  if (typeof dbAccount === 'undefined') {
    throw new OneKeyInternalError(`Account not found.`);
  }
  if (dbAccount.type !== ACCOUNT_TYPE_SIMPLE) {
    throw new NotImplemented();
  }
  return getAccountBalance(
    client,
    (dbAccount as DBSimpleAccount).address,
    tokenIds,
    withMain,
  );
}

export {
  fromDBAccountToAccount,
  getWatchingAccountToCreate,
  isAccountCompatibleWithNetwork,
  getAccountBalance,
  getDBAccountBalance,
};
