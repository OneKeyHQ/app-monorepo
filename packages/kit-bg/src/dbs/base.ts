import { Buffer } from 'buffer';

import type { RevealableSeed } from '@onekeyhq/core/src/secret';
import { decrypt } from '@onekeyhq/core/src/secret';
import {
  generateKeypair,
  rsaDecrypt,
  rsaEncrypt,
} from '@onekeyhq/core/src/secret';

import type { IDeviceType } from '@onekeyfe/hd-core';

export type Avatar = {
  emoji: string | 'img'; // lazy load EmojiTypes
  bgColor: string;
};

enum AccountType {
  SIMPLE = 'simple',
  UTXO = 'utxo',
  VARIANT = 'variant',
  // used for allNetworks
  FAKE = 'FAKE',
}

enum CredentialType {
  SOFTWARE = 'software', // HD
  HARDWARE = 'hardware',
  PRIVATE_KEY = 'private_key', // Imported
  WATCHING = 'watching',
}

type BaseObject = {
  id: string;
};

type HasName = BaseObject & {
  name: string;
};

type DBBaseAccount = HasName & {
  type: AccountType;
  path: string;
  coinType: string;
  template?: string;
};

type DBSimpleAccount = DBBaseAccount & {
  pub: string;
  address: string;
};

type DBUTXOAccount = DBBaseAccount & {
  pubKey?: string; // TODO rename to pub
  xpub: string;
  xpubSegwit?: string; // wrap regular xpub into bitcoind native descriptor
  address: string; // Display/selected address
  addresses: Record<string, string>;
  customAddresses?: Record<string, string>; // for btc custom address
};

type DBVariantAccount = DBBaseAccount & {
  pub: string;
  address: string; // Base address
  // VARIANT: Network -> address
  // UTXO: relPath -> address
  addresses: Record<string, string>;
};

type DBAccount = DBSimpleAccount | DBUTXOAccount | DBVariantAccount;

export type DBAccountDerivation = BaseObject & {
  walletId: string;
  accounts: string[];
  template: string;
};

export type ISetAccountTemplateParams = {
  accountId: string;
  template: string;
};

export type IAddAccountDerivationParams = {
  walletId: string;
  accountId: string;
  impl: string;
  template: string;
  derivationStore?: IDBObjectStore;
};

export type PrivateKeyCredential = {
  type: CredentialType.PRIVATE_KEY;
  privateKey: Buffer;
  password: string;
};

export type DBDevice = HasName & {
  features: string;
  mac: string;
  name: string;
  uuid: string;
  deviceId: string;
  deviceType: string;
  payloadJson: string;
  createdAt: number;
  updatedAt: number;
};

const WALLET_TYPE_HD = 'hd';
const WALLET_TYPE_HW = 'hw';
const WALLET_TYPE_IMPORTED = 'imported'; // as walletId
const WALLET_TYPE_WATCHING = 'watching'; // as walletId
const WALLET_TYPE_EXTERNAL = 'external'; // as walletId

type WalletType =
  | typeof WALLET_TYPE_HD
  | typeof WALLET_TYPE_HW
  | typeof WALLET_TYPE_IMPORTED
  | typeof WALLET_TYPE_WATCHING
  | typeof WALLET_TYPE_EXTERNAL;

type Wallet = HasName & {
  type: WalletType;
  backuped: boolean;
  accounts: Array<string>;
  nextAccountIds: Record<string, number>; // purpose + cointype => index
  associatedDevice?: string; // alias to `deviceId`
  avatar?: Avatar;
  deviceType?: string;
  hidden?: boolean;
  passphraseState?: string;
};
export type DBWallet = Wallet;

type ISetNextAccountIdsParams = {
  walletId: string;
  nextAccountIds: Record<string, number>;
};

export type DevicePayload = {
  onDeviceInputPin?: boolean;
};

export type Device = Omit<DBDevice, 'payloadJson'> & {
  payload: DevicePayload;
};

type OneKeyContext = {
  id: string;
  nextHD: number;
  verifyString: string;
  networkOrderChanged?: boolean;
  pendingWallets?: Array<string>;
  backupUUID: string;
};

type StoredSeedCredential = {
  entropy: string;
  seed: string;
};

type StoredPrivateKeyCredential = {
  privateKey: string;
};

type StoredCredential = StoredSeedCredential | StoredPrivateKeyCredential;

type ExportedSeedCredential = {
  type: 'hd';
  entropy: Buffer;
  seed: Buffer;
};

type ExportedPrivateKeyCredential = {
  type: 'imported';
  privateKey: Buffer;
};

type ExportedCredential = ExportedSeedCredential | ExportedPrivateKeyCredential;

type CreateHDWalletParams = {
  password: string;
  rs: RevealableSeed;
  backuped: boolean;
  name?: string;
  avatar?: Avatar;
  nextAccountIds?: Record<string, number>;
};

type CreateHWWalletParams = {
  id: string;
  name: string;
  avatar?: Avatar;
  connectId: string;
  deviceId?: string;
  deviceType: IDeviceType;
  deviceUUID: string;
  features: string;
  passphraseState?: string;
};

type SetWalletNameAndAvatarParams = {
  name?: string;
  avatar?: Avatar;
};

const DEFAULT_VERIFY_STRING = 'OneKey';
const MAIN_CONTEXT = 'mainContext';

function checkPassword(context: OneKeyContext, password: string): boolean {
  if (!context) {
    console.error('Unable to get main context.');
    return false;
  }
  if (context.verifyString === DEFAULT_VERIFY_STRING) {
    return true;
  }
  try {
    return (
      decrypt(password, Buffer.from(context.verifyString, 'hex')).toString() ===
      DEFAULT_VERIFY_STRING
    );
  } catch {
    return false;
  }
}
export interface IDbApiGetContextOptions {
  verifyPassword?: string;
}
interface DBAPI {
  getContext(
    options?: IDbApiGetContextOptions,
  ): Promise<OneKeyContext | null | undefined>;
  updatePassword(oldPassword: string, newPassword: string): Promise<void>;
  reset(): Promise<void>;

  getBackupUUID(): Promise<string>;
  dumpCredentials(password: string): Promise<Record<string, string>>;

  /**
   * Get all wallets
   * @param includeAllPassphraseWallet Whether to load the hidden Passphrase wallet
   * @param displayPassphraseWalletIds Need to display Passphrase wallet
   */
  getWallets(option?: {
    includeAllPassphraseWallet?: boolean;
    displayPassphraseWalletIds?: string[];
  }): Promise<Array<Wallet>>;
  getWallet(walletId: string): Promise<Wallet | undefined>;
  getWalletByDeviceId(deviceId: string): Promise<Array<Wallet>>;
  createHDWallet(params: CreateHDWalletParams): Promise<Wallet>;
  addHWWallet(params: CreateHWWalletParams): Promise<Wallet>;
  removeWallet(walletId: string, password: string): Promise<void>;
  setWalletNameAndAvatar(
    walletId: string,
    params: SetWalletNameAndAvatarParams,
  ): Promise<Wallet>;
  updateWalletNextAccountIds({
    walletId,
    nextAccountIds,
  }: ISetNextAccountIdsParams): Promise<Wallet>;

  getCredential(
    credentialId: string, // walletId || acountId
    password: string,
  ): Promise<ExportedCredential>;
  confirmHDWalletBackuped(walletId: string): Promise<Wallet>;
  confirmWalletCreated(walletId: string): Promise<Wallet>;
  cleanupPendingWallets(): Promise<void>;

  addAccountToWallet(
    walletId: string,
    account: DBAccount,
    importedCredential?: PrivateKeyCredential,
  ): Promise<DBAccount>;
  getAllAccounts(): Promise<Array<DBAccount>>;
  getAccounts(accountIds: Array<string>): Promise<Array<DBAccount>>;
  getAccountByAddress(params: {
    address: string;
    coinType?: string;
  }): Promise<DBAccount>;
  getAccount(accountId: string): Promise<DBAccount>;
  removeAccount(
    walletId: string,
    accountId: string,
    password: string,
    rollbackNextAccountIds: Record<string, number>,
    skipPasswordCheck?: boolean,
  ): Promise<void>;
  setAccountName(accountId: string, name: string): Promise<DBAccount>;
  setAccountTemplate({
    accountId,
    template,
  }: ISetAccountTemplateParams): Promise<DBAccount>;
  updateAccountAddresses(
    accountId: string,
    networkId: string,
    address: string,
  ): Promise<DBAccount>;
  updateUTXOAccountAddresses({
    accountId,
    addresses,
    isCustomPath,
  }: {
    accountId: string;
    addresses: Record<string, string>;
    isCustomPath: boolean;
  }): Promise<DBAccount>;
  removeUTXOAccountAddresses({
    accountId,
    addresses,
    isCustomPath,
  }: {
    accountId: string;
    addresses: Record<string, string>;
    isCustomPath: boolean;
  }): Promise<DBAccount>;

  getDevices(): Promise<Array<Device>>;
  getDevice(deviceId: string): Promise<Device>;
  getDeviceByDeviceId(deviceId: string): Promise<Device>;
  updateDevicePayload(deviceId: string, payload: DevicePayload): Promise<void>;

  updateWalletName(walletId: string, name: string): Promise<void>;

  addAccountDerivation({
    walletId,
    accountId,
    impl,
    template,
  }: IAddAccountDerivationParams): Promise<void>;
  removeAccountDerivation({
    walletId,
    impl,
    template,
  }: {
    walletId: string;
    impl: string;
    template: string;
  }): Promise<void>;
  removeAccountDerivationByWalletId({
    walletId,
  }: {
    walletId: string;
  }): Promise<void>;
  removeAccountDerivationByAccountId({
    walletId,
    accountId,
  }: {
    walletId: string;
    accountId: string;
  }): Promise<void>;
  getAccountDerivationByWalletId({
    walletId,
  }: {
    walletId: string;
  }): Promise<Record<string, DBAccountDerivation>>;
}

export {
  DEFAULT_VERIFY_STRING,
  MAIN_CONTEXT,
  checkPassword,
  generateKeypair,
  rsaDecrypt,
  rsaEncrypt,
};
export type {
  CreateHDWalletParams,
  CreateHWWalletParams,
  DBAPI,
  ExportedCredential,
  ExportedPrivateKeyCredential,
  ExportedSeedCredential,
  OneKeyContext,
  SetWalletNameAndAvatarParams,
  StoredCredential,
  StoredPrivateKeyCredential,
  StoredSeedCredential,
};
