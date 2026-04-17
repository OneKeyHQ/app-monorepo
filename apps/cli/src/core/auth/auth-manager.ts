import { randomBytes } from 'node:crypto';

import { AppError } from '../../errors';
import { AuthSessionStore } from '../../infra/auth-session-store';
import { createSecureStorage } from '../../infra/keychain-storage';
import {
  KEYCHAIN_ENCRYPTION_KEY,
  KEYCHAIN_MNEMONIC_KEY,
  getSignerByImpl,
} from '../../signer';
import { encrypt, secureWipe } from '../crypto-utils';
import { secureCache } from '../secure-cache';

import { startAppTransferLogin } from './app-transfer-login';
import { extractBotWalletMnemonicFromTransferData } from './app-transfer-payload';
import { AuthSessionResolver } from './auth-session-resolver';
import {
  AUTH_DEFAULT_EVM_NETWORK_ID,
  assertValidMnemonic,
  createAppTransferSessionMetadata,
  createMnemonicSessionMetadata,
  normalizeMnemonic,
} from './mnemonic-login';

import type {
  AppTransferLoginResult,
  AuthSessionMetadata,
  MnemonicLoginResult,
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
    private readonly signerFactory: (
      impl: string,
    ) => Promise<ISigner> = getSignerByImpl,
    private readonly appTransferLogin: IAppTransferLoginExecutor = startAppTransferLogin,
  ) {
    this.resolver = new AuthSessionResolver(this.storage, this.sessionStore);
  }

  async loginWithMnemonic(rawMnemonic: string): Promise<MnemonicLoginResult> {
    const currentSession = await this.getStatus();
    if (currentSession.authStatus === 'authenticated') {
      throw new AppError(
        'AUTH_WALLET_EXISTS',
        'Wallet already exists. Log out before importing another wallet.',
        'Run: onekey auth logout',
      );
    }

    const session = await this.persistHdWalletSession({
      rawMnemonic,
      createSessionMetadata: (address, importedAt) =>
        createMnemonicSessionMetadata(address, importedAt),
    });

    return { address: session.displayAddress ?? '' };
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

    const results = await Promise.allSettled([
      this.storage.delete(KEYCHAIN_MNEMONIC_KEY),
      this.storage.delete(KEYCHAIN_ENCRYPTION_KEY),
      this.sessionStore.clear(),
    ]);

    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    return rejected ? AppError.from(rejected.reason) : null;
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
