import { Buffer } from 'buffer';

import { RevealableSeed } from '@onekeyfe/blockchain-libs/dist/secret';
import {
  decrypt,
  encrypt,
} from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import { IDeviceType } from '@onekeyfe/hd-core';

import { Avatar } from '@onekeyhq/kit/src/utils/emojiUtils';

import { DBAccount } from '../types/account';
import { PrivateKeyCredential } from '../types/credential';
import { Device, DevicePayload } from '../types/device';
import {
  HistoryEntry,
  HistoryEntryMeta,
  HistoryEntryStatus,
  HistoryEntryType,
} from '../types/history';
import { DBNetwork, UpdateNetworkParams } from '../types/network';
import { Token } from '../types/token';
import { Wallet } from '../types/wallet';

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
  entropy: Buffer;
  seed: Buffer;
};

type ExportedPrivateKeyCredential = {
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
};

type SetWalletNameAndAvatarParams = {
  name?: string;
  avatar?: Avatar;
};

const DEFAULT_VERIFY_STRING = 'OneKey';
const MAIN_CONTEXT = 'mainContext';

export const DEFAULT_RPC_ENDPOINT_TO_CLEAR: Record<string, string> = {
  'evm--1': 'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  'evm--56': 'https://bsc-dataseed1.binance.org',
  'evm--137': 'https://polygon-rpc.com',
};

function checkPassword(context: OneKeyContext, password: string): boolean {
  if (typeof context === 'undefined') {
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
interface DBAPI {
  getContext(): Promise<OneKeyContext | undefined>;
  updatePassword(oldPassword: string, newPassword: string): Promise<void>;
  reset(): Promise<void>;

  getBackupUUID(): Promise<string>;
  dumpCredentials(password: string): Promise<Record<string, string>>;

  listNetworks(): Promise<Array<DBNetwork>>;
  addNetwork(network: DBNetwork): Promise<DBNetwork>;
  getNetwork(networkId: string): Promise<DBNetwork>;
  updateNetworkList(
    networks: Array<[string, boolean]>,
    syncingDefault?: boolean,
  ): Promise<void>;
  updateNetwork(
    networkId: string,
    params: UpdateNetworkParams,
  ): Promise<DBNetwork>;
  deleteNetwork(networkId: string): Promise<void>;

  addToken(token: Token): Promise<Token>;
  getToken(tokenId: string): Promise<Token | undefined>;
  getTokens(networkId: string, accountId?: string): Promise<Array<Token>>;
  addTokenToAccount(accountId: string, tokenId: string): Promise<Token>;
  removeTokenFromAccount(accountId: string, tokenId: string): Promise<void>;

  getWallets(): Promise<Array<Wallet>>;
  getWallet(walletId: string): Promise<Wallet | undefined>;
  getWalletByDeviceId(deviceId: string): Promise<Wallet | undefined>;
  createHDWallet(params: CreateHDWalletParams): Promise<Wallet>;
  addHWWallet(params: CreateHWWalletParams): Promise<Wallet>;
  removeWallet(walletId: string, password: string): Promise<void>;
  setWalletNameAndAvatar(
    walletId: string,
    params: SetWalletNameAndAvatarParams,
  ): Promise<Wallet>;
  getCredential(
    walletId: string,
    password: string,
  ): Promise<ExportedCredential>;
  confirmHDWalletBackuped(walletId: string): Promise<Wallet>;
  confirmWalletCreated(walletId: string): Promise<Wallet>;

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
  ): Promise<void>;
  setAccountName(accountId: string, name: string): Promise<DBAccount>;
  addAccountAddress(
    accountId: string,
    networkId: string,
    address: string,
  ): Promise<DBAccount>;

  addHistoryEntry(
    id: string,
    networkId: string,
    accountId: string,
    type: HistoryEntryType,
    status: HistoryEntryStatus,
    meta: HistoryEntryMeta,
  ): Promise<void>;
  updateHistoryEntryStatuses(
    statusMap: Record<string, HistoryEntryStatus>,
  ): Promise<void>;
  removeHistoryEntry(entryId: string): Promise<void>;
  getHistory(
    limit: number,
    networkId: string,
    accountId: string,
    contract?: string,
    before?: number,
  ): Promise<Array<HistoryEntry>>;
  getDevices(): Promise<Array<Device>>;
  getDevice(deviceId: string): Promise<Device>;
  getDeviceByDeviceId(deviceId: string): Promise<Device>;
  updateWalletName(walletId: string, name: string): Promise<void>;
  updateDevicePayload(deviceId: string, payload: DevicePayload): Promise<void>;
}

export type {
  DBAPI,
  OneKeyContext,
  StoredCredential,
  StoredSeedCredential,
  StoredPrivateKeyCredential,
  ExportedCredential,
  ExportedSeedCredential,
  ExportedPrivateKeyCredential,
  CreateHDWalletParams,
  CreateHWWalletParams,
  SetWalletNameAndAvatarParams,
};
export { checkPassword, DEFAULT_VERIFY_STRING, encrypt, decrypt, MAIN_CONTEXT };
