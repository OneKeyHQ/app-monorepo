import type { RevealableSeed } from '@onekeyhq/core/src/secret';

import type { IDeviceType } from '@onekeyfe/hd-core';

// ---------------------------------------------- const
export const DEFAULT_VERIFY_STRING = 'OneKey';
export const DB_MAIN_CONTEXT_ID = 'mainContext';
export const WALLET_TYPE_HD = 'hd';
export const WALLET_TYPE_HW = 'hw';
export const WALLET_TYPE_IMPORTED = 'imported'; // as walletId
export const WALLET_TYPE_WATCHING = 'watching'; // as walletId
export const WALLET_TYPE_EXTERNAL = 'external'; // as walletId

// ---------------------------------------------- enums
export enum AccountType {
  SIMPLE = 'simple',
  UTXO = 'utxo',
  VARIANT = 'variant',
  // used for allNetworks
  FAKE = 'FAKE',
}
export enum CredentialType {
  SOFTWARE = 'software', // HD
  HARDWARE = 'hardware',
  PRIVATE_KEY = 'private_key', // Imported
  WATCHING = 'watching',
}

// ---------------------------------------------- base
export type BaseObject = {
  id: string;
};
export type HasName = BaseObject & {
  name: string;
};
export type OneKeyContext = {
  id: string; // DB_MAIN_CONTEXT_ID
  nextHD: number;
  verifyString: string;
  networkOrderChanged?: boolean;
  pendingWallets?: Array<string>;
  backupUUID: string;
};
export type IDbApiGetContextOptions = {
  verifyPassword?: string;
};

// ---------------------------------------------- credential
export type DBCredential = BaseObject & {
  credential: string;
};
export type PrivateKeyCredential = {
  type: CredentialType.PRIVATE_KEY;
  privateKey: Buffer;
  password: string;
};
export type StoredSeedCredential = {
  entropy: string;
  seed: string;
};
export type StoredPrivateKeyCredential = {
  privateKey: string;
};
export type StoredCredential =
  | StoredSeedCredential
  | StoredPrivateKeyCredential;
export type ExportedSeedCredential = {
  type: 'hd';
  entropy: Buffer;
  seed: Buffer;
};
export type ExportedPrivateKeyCredential = {
  type: 'imported';
  privateKey: Buffer;
};
export type ExportedCredential =
  | ExportedSeedCredential
  | ExportedPrivateKeyCredential;

// ---------------------------------------------- wallet
export type WalletType =
  | typeof WALLET_TYPE_HD
  | typeof WALLET_TYPE_HW
  | typeof WALLET_TYPE_IMPORTED
  | typeof WALLET_TYPE_WATCHING
  | typeof WALLET_TYPE_EXTERNAL;
export type Wallet = HasName & {
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
export type CreateHDWalletParams = {
  password: string;
  rs: RevealableSeed;
  backuped: boolean;
  name?: string;
  avatar?: Avatar;
  nextAccountIds?: Record<string, number>;
};
export type CreateHWWalletParams = {
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
export type SetWalletNameAndAvatarParams = {
  name?: string;
  avatar?: Avatar;
};

// ---------------------------------------------- account
export type Avatar = {
  emoji: string | 'img'; // lazy load EmojiTypes
  bgColor: string;
};
export type DBBaseAccount = HasName & {
  type: AccountType;
  path: string;
  coinType: string;
  template?: string;
};
export type DBSimpleAccount = DBBaseAccount & {
  pub: string;
  address: string;
};
export type DBUTXOAccount = DBBaseAccount & {
  pubKey?: string; // TODO rename to pub
  xpub: string;
  xpubSegwit?: string; // wrap regular xpub into bitcoind native descriptor
  address: string; // Display/selected address
  addresses: Record<string, string>;
  customAddresses?: Record<string, string>; // for btc custom address
};
export type DBVariantAccount = DBBaseAccount & {
  pub: string;
  address: string; // Base address
  // VARIANT: Network -> address
  // UTXO: relPath -> address
  addresses: Record<string, string>;
};
export type DBAccount = DBSimpleAccount | DBUTXOAccount | DBVariantAccount;
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
export type ISetNextAccountIdsParams = {
  walletId: string;
  nextAccountIds: Record<string, number>;
};

// ---------------------------------------------- device
export type DevicePayload = {
  onDeviceInputPin?: boolean;
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
export type Device = Omit<DBDevice, 'payloadJson'> & {
  payload: DevicePayload;
};

// ---------------------------------------------- test only
export type DBTestNewStore = HasName & {
  test: string;
};
