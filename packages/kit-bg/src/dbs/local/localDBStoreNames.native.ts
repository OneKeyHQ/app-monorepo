import { ensureRunOnNative } from '@onekeyhq/shared/src/utils/assertUtils';

ensureRunOnNative();
export enum ELocalDBStoreNames {
  // **** increase INDEXED_DB_VERSION when add or remove store ****
  Context = 'Context',
  Credential = 'Credential',
  Wallet = 'Wallet',
  Account = 'Account',
  AccountDerivation = 'AccountDerivation',
  IndexedAccount = 'IndexedAccount',
  Device = 'Device',
}
