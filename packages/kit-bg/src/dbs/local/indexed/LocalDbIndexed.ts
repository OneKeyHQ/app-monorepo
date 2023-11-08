/* eslint-disable @typescript-eslint/no-unused-vars */
import { isNil } from 'lodash';

import { decrypt, encrypt } from '@onekeyhq/core/src/secret';
import {
  OneKeyInternalError,
  WrongPassword,
} from '@onekeyhq/shared/src/errors';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import {
  type CreateHDWalletParams,
  type CreateHWWalletParams,
  type DBAccount,
  type DBAccountDerivation,
  type DBCredential,
  DB_MAIN_CONTEXT_ID,
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
  type StoredPrivateKeyCredential,
  type StoredSeedCredential,
  type Wallet,
} from '../types';

import { LocalDbIndexedBase } from './LocalDbIndexedBase';
import { EIndexedDBStoreNames } from './types';

import type { KnownDevice } from '@onekeyfe/hd-core';

export class LocalDbIndexed extends LocalDbIndexedBase {
  // ---------------------------------------------- base

  override async getContext(
    options?: IDbApiGetContextOptions | undefined,
  ): Promise<OneKeyContext> {
    const ctx = await this.getRecordById(
      EIndexedDBStoreNames.context,
      DB_MAIN_CONTEXT_ID,
    );

    if (!ctx) {
      throw new Error('failed get local db context');
    }

    if (options?.verifyPassword) {
      const { verifyPassword } = options;
      if (!this.checkPassword(ctx, verifyPassword)) {
        throw new WrongPassword();
      }
    }

    return ctx;
  }

  override async reset(): Promise<void> {
    return this.deleteIndexedDb();
  }

  override async getBackupUUID(): Promise<string> {
    const context = await this.getContext();
    const { backupUUID } = context;
    if (!isNil(backupUUID)) {
      return backupUUID;
    }
    const store = await this.getObjectStore(EIndexedDBStoreNames.context);
    context.backupUUID = generateUUID();
    await store.put(context);
    return backupUUID;
  }

  override confirmHDWalletBackuped(walletId: string): Promise<Wallet> {
    throw new Error('Method not implemented.');
  }
  // ---------------------------------------------- credential

  override async updatePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const context = await this.getContext();
    if (!context) return;
    const store = await this.getObjectStore(EIndexedDBStoreNames.context);
    context.verifyString = encrypt(
      newPassword,
      Buffer.from(DEFAULT_VERIFY_STRING),
    ).toString('hex');
    await store.put(context);
    if (!oldPassword) return;
    const credentialsStore = await this.getObjectStore(
      EIndexedDBStoreNames.credentials,
    );
    const cursor = await credentialsStore.openCursor();
    if (!cursor) return;
    const credentialItem: DBCredential = cursor.value;

    if (credentialItem.id.startsWith('imported')) {
      const privateKeyCredentialJSON: StoredPrivateKeyCredential = JSON.parse(
        credentialItem.credential,
      );
      credentialItem.credential = JSON.stringify({
        privateKey: encrypt(
          newPassword,
          decrypt(
            oldPassword,
            Buffer.from(privateKeyCredentialJSON.privateKey, 'hex'),
          ),
        ).toString('hex'),
      });
    } else {
      const credentialJSON: StoredSeedCredential = JSON.parse(
        credentialItem.credential,
      );
      credentialItem.credential = JSON.stringify({
        entropy: encrypt(
          newPassword,
          decrypt(oldPassword, Buffer.from(credentialJSON.entropy, 'hex')),
        ).toString('hex'),
        seed: encrypt(
          newPassword,
          decrypt(oldPassword, Buffer.from(credentialJSON.seed, 'hex')),
        ).toString('hex'),
      });
    }

    await cursor.update(credentialItem);
    await cursor.continue();
  }

  override dumpCredentials(password: string): Promise<Record<string, string>> {
    throw new Error('Method not implemented.');
  }

  override getCredential(
    credentialId: string,
    password: string,
  ): Promise<ExportedCredential> {
    throw new Error('Method not implemented.');
  }

  // ---------------------------------------------- wallet

  override getWallets(
    option?:
      | {
          includeAllPassphraseWallet?: boolean | undefined;
          displayPassphraseWalletIds?: string[] | undefined;
        }
      | undefined,
  ): Promise<Wallet[]> {
    throw new Error('Method not implemented.');
  }

  override getWallet(walletId: string): Promise<Wallet | undefined> {
    throw new Error('Method not implemented.');
  }

  override getWalletByDeviceId(deviceId: string): Promise<Wallet[]> {
    throw new Error('Method not implemented.');
  }

  override createHDWallet(params: CreateHDWalletParams): Promise<Wallet> {
    throw new Error('Method not implemented.');
  }

  override addHWWallet(params: CreateHWWalletParams): Promise<Wallet> {
    throw new Error('Method not implemented.');
  }

  override removeWallet(walletId: string, password: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  override updateWalletName(walletId: string, name: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  override setWalletNameAndAvatar(
    walletId: string,
    params: SetWalletNameAndAvatarParams,
  ): Promise<Wallet> {
    throw new Error('Method not implemented.');
  }

  override updateWalletNextAccountIds({
    walletId,
    nextAccountIds,
  }: ISetNextAccountIdsParams): Promise<Wallet> {
    throw new Error('Method not implemented.');
  }

  override confirmWalletCreated(walletId: string): Promise<Wallet> {
    throw new Error('Method not implemented.');
  }

  override cleanupPendingWallets(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  override addAccountToWallet(
    walletId: string,
    account: DBAccount,
    importedCredential?: PrivateKeyCredential | undefined,
  ): Promise<DBAccount> {
    throw new Error('Method not implemented.');
  }

  // ---------------------------------------------- account
  override getAllAccounts(): Promise<DBAccount[]> {
    throw new Error('Method not implemented.');
  }

  override getAccounts(accountIds: string[]): Promise<DBAccount[]> {
    throw new Error('Method not implemented.');
  }

  override getAccountByAddress(params: {
    address: string;
    coinType?: string | undefined;
  }): Promise<DBAccount> {
    throw new Error('Method not implemented.');
  }

  override getAccount(accountId: string): Promise<DBAccount> {
    throw new Error('Method not implemented.');
  }

  override removeAccount(
    walletId: string,
    accountId: string,
    password: string,
    rollbackNextAccountIds: Record<string, number>,
    skipPasswordCheck?: boolean | undefined,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  override setAccountName(accountId: string, name: string): Promise<DBAccount> {
    throw new Error('Method not implemented.');
  }

  override setAccountTemplate({
    accountId,
    template,
  }: ISetAccountTemplateParams): Promise<DBAccount> {
    throw new Error('Method not implemented.');
  }

  override updateAccountAddresses(
    accountId: string,
    networkId: string,
    address: string,
  ): Promise<DBAccount> {
    throw new Error('Method not implemented.');
  }

  override updateUTXOAccountAddresses({
    accountId,
    addresses,
    isCustomPath,
  }: {
    accountId: string;
    addresses: Record<string, string>;
    isCustomPath: boolean;
  }): Promise<DBAccount> {
    throw new Error('Method not implemented.');
  }

  override removeUTXOAccountAddresses({
    accountId,
    addresses,
    isCustomPath,
  }: {
    accountId: string;
    addresses: Record<string, string>;
    isCustomPath: boolean;
  }): Promise<DBAccount> {
    throw new Error('Method not implemented.');
  }

  override addAccountDerivation({
    walletId,
    accountId,
    impl,
    template,
  }: IAddAccountDerivationParams): Promise<void> {
    throw new Error('Method not implemented.');
  }

  override removeAccountDerivation({
    walletId,
    impl,
    template,
  }: {
    walletId: string;
    impl: string;
    template: string;
  }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  override removeAccountDerivationByWalletId({
    walletId,
  }: {
    walletId: string;
  }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  override removeAccountDerivationByAccountId({
    walletId,
    accountId,
  }: {
    walletId: string;
    accountId: string;
  }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  override getAccountDerivationByWalletId({
    walletId,
  }: {
    walletId: string;
  }): Promise<Record<string, DBAccountDerivation>> {
    throw new Error('Method not implemented.');
  }

  // ---------------------------------------------- device
  override getDevices(): Promise<KnownDevice[]> {
    throw new Error('Method not implemented.');
  }

  override getDevice(deviceId: string): Promise<KnownDevice> {
    throw new Error('Method not implemented.');
  }

  override getDeviceByDeviceId(deviceId: string): Promise<KnownDevice> {
    throw new Error('Method not implemented.');
  }

  override updateDevicePayload(
    deviceId: string,
    payload: DevicePayload,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
