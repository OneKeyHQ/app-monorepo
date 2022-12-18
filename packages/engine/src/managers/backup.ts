import uuid from 'react-native-uuid';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyInternalError } from '../errors';

import type { AccountType, DBAccount } from '../types/account';

// uuid.v5('onekey', '00000000-0000-0000-0000-000000000000')
// const ONEKEY_NAMESPACE = '30303338-6435-5664-a334-323538396638';
// uuid.v5('HDAccount', ONEKEY_NAMESPACE)
const HD_ACCOUNT_NAMESPACE = '31626535-3739-5531-a536-306136356236';
// uuid.v5('ImportedAccount', ONEKEY_NAMESPACE)
const IMPORTED_ACCOUNT_NAMESPACE = '36383162-6565-5764-a462-343664326230';
// uuid.v5('WatchingAccount', ONEKEY_NAMESPACE)
const WATCHING_ACCOUNT_NAMESPACE = '62363931-3936-5332-b633-636233663336';

export const HDWALLET_BACKUP_VERSION = 1;
export const IMPORTED_ACCOUNT_BACKUP_VERSION = 1;
export const WATCHING_ACCOUNT_BACKUP_VERSION = 1;

export function getHDAccountUUID(account: DBAccount): string {
  let uuidName = '';

  const {
    type,
    path,
    pub = '',
    xpub = '',
  }: { type: AccountType; path: string; pub?: string; xpub?: string } = account;

  if ((type === 'simple' || type === 'variant') && pub.length > 0) {
    // Simple account & Variant address account should have a pubkey
    uuidName = `${path},${pub}`;
  } else if (type === 'utxo' && xpub.length > 0) {
    // UTXO account should have a xpub
    uuidName = `${path},${xpub}`;
  }

  if (uuidName.length > 0) {
    return uuid.v5(uuidName, HD_ACCOUNT_NAMESPACE) as string;
  }

  debugLogger.engine.error(
    'Unable to get UUID for account',
    account.id,
    account.name,
  );
  throw new OneKeyInternalError('Unable to get UUID for account');
}

export function getImportedAccountUUID(account: DBAccount): string {
  return uuid.v5(account.id, IMPORTED_ACCOUNT_NAMESPACE) as string;
}

export function getWatchingAccountUUID(account: DBAccount): string {
  return uuid.v5(account.id, WATCHING_ACCOUNT_NAMESPACE) as string;
}
