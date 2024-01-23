import { Buffer } from 'buffer';

import type { RevealableSeed } from '@onekeyhq/engine/src/secret';
import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import type { Avatar } from '@onekeyhq/shared/src/utils/emojiUtils';

import {
  generateKeypair,
  rsaDecrypt,
  rsaEncrypt,
} from '../secret/encryptors/rsa';

import type { DBAccount } from '../types/account';
import type {
  DBAccountDerivation,
  IAddAccountDerivationParams,
  ISetAccountTemplateParams,
} from '../types/accountDerivation';
import type {
  PrivateKeyCredential,
  PrivateKeyCredentialWithId,
} from '../types/credential';
import type { Device, DevicePayload } from '../types/device';
import type {
  HistoryEntry,
  HistoryEntryMeta,
  HistoryEntryStatus,
  HistoryEntryType,
} from '../types/history';
import type { DBNetwork, UpdateNetworkParams } from '../types/network';
import type { Token } from '../types/token';
import type { ISetNextAccountIdsParams, Wallet } from '../types/wallet';
import type { IFeeInfoUnit } from '../vaults/types';
import type { IDeviceType } from '@onekeyfe/hd-core';

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
  passphraseState?: string;
};

type SetWalletNameAndAvatarParams = {
  name?: string;
  avatar?: Avatar;
};

const DEFAULT_VERIFY_STRING = 'OneKey';
const MAIN_CONTEXT = 'mainContext';

export const DEFAULT_RPC_ENDPOINT_TO_CLEAR: Record<string, string> = {
  [OnekeyNetwork.eth]:
    'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  [OnekeyNetwork.bsc]: 'https://bsc-dataseed1.binance.org',
  [OnekeyNetwork.polygon]: 'https://polygon-rpc.com',
};

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
interface DBAPI {
  getContext(): Promise<OneKeyContext | null | undefined>;
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
    walletId: string,
    password: string,
  ): Promise<ExportedCredential>;
  createPrivateKeyCredential(
    credential: PrivateKeyCredentialWithId,
  ): Promise<ExportedPrivateKeyCredential>;
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
  setAccountPub(
    accountId: string,
    pub: string,
    deletePubKey?: boolean,
  ): Promise<DBAccount>;
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
  getCustomFee(networkId: string): Promise<IFeeInfoUnit | undefined>;
  updateCustomFee(
    networkId: string,
    customFee: IFeeInfoUnit | null | undefined,
  ): Promise<void>;
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
export {
  checkPassword,
  DEFAULT_VERIFY_STRING,
  MAIN_CONTEXT,
  generateKeypair,
  rsaDecrypt,
  rsaEncrypt,
};
