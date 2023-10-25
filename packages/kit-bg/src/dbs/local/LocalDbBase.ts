import { Buffer } from 'buffer';

import { decrypt } from '@onekeyhq/core/src/secret';
import { WrongPassword } from '@onekeyhq/shared/src/errors';

import {
  type CreateHDWalletParams,
  type CreateHWWalletParams,
  type DBAccount,
  type DBAccountDerivation,
  DEFAULT_VERIFY_STRING,
  type DevicePayload,
  type ExportedCredential,
  type IAddAccountDerivationParams,
  type IDbApiGetContextOptions,
  type ISetAccountTemplateParams,
  type ISetNextAccountIdsParams,
  type OneKeyContext,
  type PrivateKeyCredential,
  type SetWalletNameAndAvatarParams,
  type Wallet,
} from './types';

import type { Device } from '@onekeyfe/hd-core';

export abstract class LocalDbBase {
  // ---------------------------------------------- base
  abstract getContext(
    options?: IDbApiGetContextOptions,
  ): Promise<OneKeyContext>;

  abstract reset(): Promise<void>;

  abstract getBackupUUID(): Promise<string>;

  abstract confirmHDWalletBackuped(walletId: string): Promise<Wallet>;

  // ---------------------------------------------- credential
  async checkPassword(password: string): Promise<boolean> {
    const context = await this.getContext({ verifyPassword: password });
    if (!context) {
      console.error('Unable to get main context.');
      return false;
    }
    if (context.verifyString === DEFAULT_VERIFY_STRING) {
      return true;
    }
    try {
      return (
        decrypt(
          password,
          Buffer.from(context.verifyString, 'hex'),
        ).toString() === DEFAULT_VERIFY_STRING
      );
    } catch {
      return false;
    }
  }

  async verifyPassword(password: string): Promise<void> {
    const r = await this.checkPassword(password);
    if (!r) {
      throw new WrongPassword();
    }
  }

  abstract updatePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<void>;

  abstract dumpCredentials(password: string): Promise<Record<string, string>>;

  abstract getCredential(
    credentialId: string, // walletId || acountId
    password: string,
  ): Promise<ExportedCredential>;

  // ---------------------------------------------- wallet
  /**
   * Get all wallets

   * @param includeAllPassphraseWallet Whether to load the hidden Pa
ssphrase wallet
   * @param displayPassphraseWalletIds Need to display Passphrase wallet

   */

  abstract getWallets(option?: {
    includeAllPassphraseWallet?: boolean;

    displayPassphraseWalletIds?: string[];
  }): Promise<Array<Wallet>>;

  abstract getWallet(walletId: string): Promise<Wallet | undefined>;

  abstract getWalletByDeviceId(deviceId: string): Promise<Array<Wallet>>;

  abstract createHDWallet(params: CreateHDWalletParams): Promise<Wallet>;

  abstract addHWWallet(params: CreateHWWalletParams): Promise<Wallet>;

  abstract removeWallet(walletId: string, password: string): Promise<void>;

  abstract updateWalletName(walletId: string, name: string): Promise<void>;

  abstract setWalletNameAndAvatar(
    walletId: string,
    params: SetWalletNameAndAvatarParams,
  ): Promise<Wallet>;

  abstract updateWalletNextAccountIds({
    walletId,
    nextAccountIds,
  }: ISetNextAccountIdsParams): Promise<Wallet>;

  abstract confirmWalletCreated(walletId: string): Promise<Wallet>;

  abstract cleanupPendingWallets(): Promise<void>;

  abstract addAccountToWallet(
    walletId: string,
    account: DBAccount,
    importedCredential?: PrivateKeyCredential,
  ): Promise<DBAccount>;

  // ---------------------------------------------- account
  abstract getAllAccounts(): Promise<Array<DBAccount>>;

  abstract getAccounts(accountIds: Array<string>): Promise<Array<DBAccount>>;

  abstract getAccountByAddress(params: {
    address: string;

    coinType?: string;
  }): Promise<DBAccount>;

  abstract getAccount(accountId: string): Promise<DBAccount>;

  abstract removeAccount(
    walletId: string,
    accountId: string,
    password: string,

    rollbackNextAccountIds: Record<string, number>,
    skipPasswordCheck?: boolean,
  ): Promise<void>;

  abstract setAccountName(accountId: string, name: string): Promise<DBAccount>;

  abstract setAccountTemplate({
    accountId,
    template,
  }: ISetAccountTemplateParams): Promise<DBAccount>;

  abstract updateAccountAddresses(
    accountId: string,
    networkId: string,
    address: string,
  ): Promise<DBAccount>;

  abstract updateUTXOAccountAddresses({
    accountId,
    addresses,
    isCustomPath,
  }: {
    accountId: string;
    addresses: Record<string, string>;
    isCustomPath: boolean;
  }): Promise<DBAccount>;

  abstract removeUTXOAccountAddresses({
    accountId,
    addresses,

    isCustomPath,
  }: {
    accountId: string;
    addresses: Record<string, string>;
    isCustomPath: boolean;
  }): Promise<DBAccount>;

  abstract addAccountDerivation({
    walletId,
    accountId,
    impl,
    template,
  }: IAddAccountDerivationParams): Promise<void>;

  abstract removeAccountDerivation({
    walletId,

    impl,

    template,
  }: {
    walletId: string;
    impl: string;
    template: string;
  }): Promise<void>;

  abstract removeAccountDerivationByWalletId({
    walletId,
  }: {
    walletId: string;
  }): Promise<void>;

  abstract removeAccountDerivationByAccountId({
    walletId,
    accountId,
  }: {
    walletId: string;
    accountId: string;
  }): Promise<void>;

  abstract getAccountDerivationByWalletId({
    walletId,
  }: {
    walletId: string;
  }): Promise<Record<string, DBAccountDerivation>>;

  // ---------------------------------------------- device
  abstract getDevices(): Promise<Array<Device>>;

  abstract getDevice(deviceId: string): Promise<Device>;

  abstract getDeviceByDeviceId(deviceId: string): Promise<Device>;

  abstract updateDevicePayload(
    deviceId: string,
    payload: DevicePayload,
  ): Promise<void>;
}
