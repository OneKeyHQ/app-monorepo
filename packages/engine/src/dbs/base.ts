import { Buffer } from 'buffer';

import { RevealableSeed } from '@onekeyfe/blockchain-libs/dist/secret';
import {
  decrypt,
  encrypt,
} from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';

import { Avatar } from '@onekeyhq/kit/src/utils/emojiUtils';

import { DBAccount } from '../types/account';
import { PrivateKeyCredential } from '../types/credential';
import { Device } from '../types/device';
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
};

type CreateHWWalletParams = {
  id: string;
  name: string;
  avatar?: Avatar;
};

type SetWalletNameAndAvatarParams = {
  name?: string;
  avatar?: Avatar;
};

const DEFAULT_VERIFY_STRING = 'OneKey';
const MAIN_CONTEXT = 'mainContext';

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

  addAccountToWallet(
    walletId: string,
    account: DBAccount,
    importedCredential?: PrivateKeyCredential,
  ): Promise<DBAccount>;
  getAllAccounts(): Promise<Array<DBAccount>>;
  getAccounts(accountIds: Array<string>): Promise<Array<DBAccount>>;
  getAccount(accountId: string): Promise<DBAccount>;
  removeAccount(
    walletId: string,
    accountId: string,
    password: string,
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
  upsertDevice(
    id: string,
    name: string,
    mac: string,
    features: string,
  ): Promise<void>;
  getDevices(): Promise<Array<Device>>;
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
