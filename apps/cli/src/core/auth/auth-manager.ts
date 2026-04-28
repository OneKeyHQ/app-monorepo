import { randomBytes } from 'node:crypto';

import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';

import { AppError } from '../../errors';
import { AuthSessionStore } from '../../infra/auth-session-store';
import { createSecureStorage } from '../../infra/keychain-storage';
import {
  KEYCHAIN_ENCRYPTION_KEY,
  KEYCHAIN_MNEMONIC_KEY,
  KEYCHAIN_PASSPHRASE_STATE_KEY,
  KEYCHAIN_SESSION_ID_KEY,
} from '../../signer/keychain-keys';
import {
  loadSignerBuilders,
  requireSignerBuilder,
} from '../../signer/registry';
import { encrypt, secureWipe } from '../crypto-utils';
import { secureCache } from '../secure-cache';

import { startAppTransferLogin } from './app-transfer-login';
import { extractBotWalletMnemonicFromTransferData } from './app-transfer-payload';
import { createAppTransferSessionMetadata } from './app-transfer-session';
import { AuthSessionResolver } from './auth-session-resolver';
import { AUTH_DEFAULT_EVM_NETWORK_ID } from './auth-types';
import { assertValidMnemonic, normalizeMnemonic } from './mnemonic-utils';

import type {
  AppTransferLoginResult,
  AuthSessionMetadata,
  PersistAuthSessionInput,
  ResolvedAuthSession,
  StartAppTransferLoginInput,
} from './auth-types';
import type { ISecureStorage } from '../../infra/keychain-storage';
import type { ISigner } from '../../signer/types';
import type {
  ITransferPayloadHandlingContext,
  ITransferPayloadHandlingResult,
  TransferPayloadHandler,
} from '../prime-transfer/transfer-types';

type IAppTransferLoginExecutor = (
  input: StartAppTransferLoginInput | undefined,
  dependencies: {
    onTransferData: TransferPayloadHandler;
  },
) => Promise<AppTransferLoginResult>;

export class AuthManager {
  private readonly resolver: AuthSessionResolver;

  constructor(
    private readonly storage: ISecureStorage = createSecureStorage(),
    private readonly sessionStore: AuthSessionStore = new AuthSessionStore(),
    // Login-time HD signer builder. Skips the auth gate that
    // `getSignerByImpl` enforces (the session isn't persisted yet).
    // Overridden in tests to inject a stub with a fixed address.
    private readonly signerFactory: (impl: string) => Promise<ISigner> = async (
      impl,
    ) => {
      const builders = await loadSignerBuilders(impl);
      return requireSignerBuilder(impl, builders, WALLET_TYPE_HD)();
    },
    private readonly appTransferLogin: IAppTransferLoginExecutor = startAppTransferLogin,
  ) {
    this.resolver = new AuthSessionResolver(this.storage, this.sessionStore);
  }

  async persistSession(
    input: PersistAuthSessionInput,
  ): Promise<ResolvedAuthSession> {
    const encryptionKeyBuffer = Buffer.from(input.encryptionKey, 'utf-8');

    try {
      await this.storage.set(KEYCHAIN_ENCRYPTION_KEY, encryptionKeyBuffer);
      await this.storage.set(KEYCHAIN_MNEMONIC_KEY, input.encryptedMnemonic);
      await this.sessionStore.save(input.session);

      return await this.getStatus();
    } catch (error) {
      const cleanupError = await this.rollbackSession();
      if (cleanupError) {
        throw cleanupError;
      }
      throw AppError.from(error);
    } finally {
      secureWipe(encryptionKeyBuffer);
    }
  }

  async getStatus(): Promise<ResolvedAuthSession> {
    return this.resolver.resolve();
  }

  async startAppTransferLogin(
    input: StartAppTransferLoginInput = {},
  ): Promise<AppTransferLoginResult> {
    const currentSession = await this.getStatus();
    if (currentSession.authStatus === 'authenticated') {
      throw new AppError(
        'AUTH_WALLET_EXISTS',
        'Wallet already exists. Log out before importing another wallet.',
        'Run: onekey auth logout',
      );
    }

    return this.appTransferLogin(input, {
      onTransferData: async (
        transferData,
        context: ITransferPayloadHandlingContext,
      ): Promise<ITransferPayloadHandlingResult> => {
        const mnemonic = extractBotWalletMnemonicFromTransferData(transferData);

        await this.persistHdWalletSession({
          rawMnemonic: mnemonic,
          createSessionMetadata: (address, importedAt) =>
            createAppTransferSessionMetadata(address, mnemonic, importedAt),
        });

        try {
          context.assertSessionIsActive();
        } catch (error) {
          await this.clearSession();
          throw error;
        }

        return {
          rollback: async () => {
            await this.clearSession();
          },
        };
      },
    });
  }

  async clearSession(): Promise<void> {
    const cleanupError = await this.rollbackSession();
    if (cleanupError) {
      throw cleanupError;
    }
  }

  private async rollbackSession(): Promise<AppError | null> {
    secureCache.clearAll();

    const keyResults = await Promise.allSettled([
      this.storage.delete(KEYCHAIN_MNEMONIC_KEY),
      this.storage.delete(KEYCHAIN_ENCRYPTION_KEY),
      this.storage.delete(KEYCHAIN_PASSPHRASE_STATE_KEY),
      this.storage.delete(KEYCHAIN_SESSION_ID_KEY),
    ]);

    // All secret-bearing keys (HD mnemonic/encryption AND hardware
    // passphrase/session) must be deleted before we clear the session file.
    // delete() already treats "not found" as success, so a rejection here
    // means the OS keychain genuinely refused — leaving secrets behind.
    // Keep the session file so the user stays in a recoverable state and can
    // retry logout after unlocking/granting access to the OS keychain.
    const rejected = keyResults.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (rejected) {
      return AppError.from(rejected.reason);
    }

    // Keys are gone — safe to remove the session file.
    try {
      await this.sessionStore.clear();
    } catch (error) {
      return AppError.from(error);
    }

    return null;
  }

  private async persistHdWalletSession({
    rawMnemonic,
    createSessionMetadata,
  }: {
    rawMnemonic: string;
    createSessionMetadata: (
      address: string,
      importedAt: string,
      rawMnemonic: string,
    ) => AuthSessionMetadata;
  }): Promise<ResolvedAuthSession> {
    let mnemonicBuffer: Buffer | null = null;
    let encryptionKeyBuffer: Buffer | null = null;
    let encryptedMnemonic: Buffer | null = null;

    try {
      const normalizedMnemonic = normalizeMnemonic(rawMnemonic);
      assertValidMnemonic(normalizedMnemonic);

      mnemonicBuffer = Buffer.from(normalizedMnemonic, 'utf-8');

      const encryptionKey = randomBytes(32).toString('hex');
      encryptionKeyBuffer = Buffer.from(encryptionKey, 'utf-8');
      encryptedMnemonic = await encrypt(mnemonicBuffer, encryptionKey);

      await this.storage.set(KEYCHAIN_ENCRYPTION_KEY, encryptionKeyBuffer);
      await this.storage.set(KEYCHAIN_MNEMONIC_KEY, encryptedMnemonic);

      const signer = await this.signerFactory('evm');
      const addressInfo = await signer.getAddress(AUTH_DEFAULT_EVM_NETWORK_ID);

      await this.sessionStore.save(
        createSessionMetadata(
          addressInfo.address,
          new Date().toISOString(),
          normalizedMnemonic,
        ),
      );

      return await this.getStatus();
    } catch (error) {
      const cleanupError = await this.rollbackSession();
      if (cleanupError) {
        throw cleanupError;
      }
      throw AppError.from(error);
    } finally {
      if (mnemonicBuffer) {
        secureWipe(mnemonicBuffer);
      }
      if (encryptionKeyBuffer) {
        secureWipe(encryptionKeyBuffer);
      }
      if (encryptedMnemonic) {
        secureWipe(encryptedMnemonic);
      }
    }
  }
}
