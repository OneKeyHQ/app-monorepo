import { IMPL_EVM } from '../constants';
import { OneKeyInternalError } from '../errors';
import {
  ACCOUNT_TYPE_MULADDR,
  ACCOUNT_TYPE_SIMPLE,
  Account,
  DBAccount,
  DBMulAddrAccount,
  DBSimpleAccount,
} from '../types/account';

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
  // TODO: check target is valid
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

export { fromDBAccountToAccount, getWatchingAccountToCreate };
