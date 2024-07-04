import {
  decrypt,
  decryptVerifyString,
  encrypt,
  encryptVerifyString,
  ensureSensitiveTextEncoded,
} from '@onekeyhq/core/src/secret';
import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { PasswordNotSet, WrongPassword } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { V4LocalDbBaseContainer } from './V4LocalDbBaseContainer';
import { EV4LocalDBStoreNames } from './v4localDBStoreNames';

import type {
  IV4DBContext,
  IV4DBHdCredentialRaw,
  IV4DBImportedCredentialRaw,
  IV4DBWallet,
  IV4DBWalletIdSingleton,
  IV4LocalDBRecordUpdater,
  IV4LocalDBTransaction,
} from './v4localDBTypes';
import type { IV4AvatarInfo } from '../v4types';

export abstract class V4LocalDbBase extends V4LocalDbBaseContainer {
  buildSingletonWalletRecord({
    walletId,
  }: {
    walletId: IV4DBWalletIdSingleton;
  }) {
    const walletConfig: Record<
      IV4DBWalletIdSingleton,
      {
        avatar: IV4AvatarInfo;
        walletNo: number;
      }
    > = {
      [WALLET_TYPE_IMPORTED]: {
        avatar: {},
        walletNo: 100_000_1,
      },
      [WALLET_TYPE_WATCHING]: {
        avatar: {},
        walletNo: 100_000_2,
      },
      [WALLET_TYPE_EXTERNAL]: {
        avatar: {},
        walletNo: 100_000_3,
      },
    };
    const record: IV4DBWallet = {
      id: walletId,
      avatar: walletConfig?.[walletId]?.avatar
        ? JSON.stringify(walletConfig[walletId].avatar)
        : undefined,
      name: walletId,
      type: walletId,
      backuped: true,
      accounts: [],
      nextAccountIds: { 'global': 1 },
    };
    return record;
  }

  checkPassword(context: IV4DBContext, password: string): boolean {
    if (!context) {
      console.error('Unable to get main context.');
      return false;
    }
    if (context.verifyString === DEFAULT_VERIFY_STRING) {
      return false;
    }
    try {
      return (
        decryptVerifyString({
          password,
          verifyString: context.verifyString,
        }) === DEFAULT_VERIFY_STRING
      );
    } catch {
      return false;
    }
  }

  async verifyPassword(password: string): Promise<void> {
    const ctx = await this.getRecordById({
      name: EV4LocalDBStoreNames.Context,
      id: DB_MAIN_CONTEXT_ID,
    });
    if (ctx && ctx.verifyString !== DEFAULT_VERIFY_STRING) {
      ensureSensitiveTextEncoded(password);
      const isValid = this.checkPassword(ctx, password);
      if (isValid) {
        return;
      }
      if (!isValid) {
        throw new WrongPassword();
      }
    }
    throw new PasswordNotSet();
  }

  async updateV4Password({
    oldPassword,
    newPassword,
    isCreateMode,
  }: {
    oldPassword: string;
    newPassword: string;
    isCreateMode?: boolean;
  }): Promise<void> {
    const db = await this.readyDb;
    if (oldPassword) {
      await this.verifyPassword(oldPassword);
    }
    if (!oldPassword && !isCreateMode) {
      throw new Error('changePassword ERROR: oldPassword is required');
    }
    await db.withTransaction(async (tx) => {
      if (oldPassword) {
        // update all credentials
        await this.txUpdateAllCredentialsPassword({
          tx,
          oldPassword,
          newPassword,
        });
      }

      // update context verifyString
      await this.txUpdateContextVerifyString({
        tx,
        verifyString: encryptVerifyString({
          password: newPassword,
          addPrefixString: false,
        }),
      });
    });
  }

  async txUpdateAllCredentialsPassword({
    tx,
    oldPassword,
    newPassword,
  }: {
    oldPassword: string;
    newPassword: string;
    tx: IV4LocalDBTransaction;
  }) {
    const db = await this.readyDb;
    if (!oldPassword || !newPassword) {
      throw new Error('password is required');
    }

    // update all credentials
    const { recordPairs: credentialsRecordPairs } = await db.txGetAllRecords({
      tx,
      name: EV4LocalDBStoreNames.Credential,
    });

    await db.txUpdateRecords({
      tx,
      recordPairs: credentialsRecordPairs,
      name: EV4LocalDBStoreNames.Credential,
      updater: (credential) => {
        // imported credential
        if (credential.id.startsWith('imported')) {
          const importedCredential: IV4DBImportedCredentialRaw = JSON.parse(
            credential.credential,
          );
          const privateKeyDecrypt = decrypt(
            oldPassword,
            importedCredential.privateKey,
          );
          const importedCredentialRebuild: IV4DBImportedCredentialRaw = {
            privateKey: bufferUtils.bytesToHex(
              encrypt(newPassword, privateKeyDecrypt),
            ),
          };

          credential.credential = JSON.stringify(importedCredentialRebuild);
        } else {
          // hd credential
          // IV4DBHdCredentialRaw
          const hdCredential: IV4DBHdCredentialRaw = JSON.parse(
            credential.credential,
          );
          const seedDecrypt = decrypt(oldPassword, hdCredential.seed);
          const entropyDecrypt = decrypt(oldPassword, hdCredential.entropy);

          const hdCredentialRebuild: IV4DBHdCredentialRaw = {
            seed: bufferUtils.bytesToHex(encrypt(newPassword, seedDecrypt)),
            entropy: bufferUtils.bytesToHex(
              encrypt(newPassword, entropyDecrypt),
            ),
          };

          credential.credential = JSON.stringify(hdCredentialRebuild);
        }

        return credential;
      },
    });
  }

  async txUpdateContextVerifyString({
    tx,
    verifyString,
  }: {
    tx: IV4LocalDBTransaction;
    verifyString: string;
  }) {
    await this.txUpdateContext({
      tx,
      updater: (record) => {
        record.verifyString = verifyString;
        return record;
      },
    });
  }

  async txUpdateContext({
    tx,
    updater,
  }: {
    tx: IV4LocalDBTransaction;
    updater: IV4LocalDBRecordUpdater<EV4LocalDBStoreNames.Context>;
  }) {
    const db = await this.readyDb;
    await db.txUpdateRecords({
      name: EV4LocalDBStoreNames.Context,
      ids: [DB_MAIN_CONTEXT_ID],
      tx,
      updater,
    });
  }
}
