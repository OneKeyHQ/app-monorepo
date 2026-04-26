import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { mnemonicToRevealableSeed } from '@onekeyhq/core/src/secret';
import {
  EPrimeTransferDataType,
  EPrimeTransferServerType,
  type IPrimeTransferData,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import * as appTransferPayloadModule from '../core/auth/app-transfer-payload';
import { AuthManager } from '../core/auth/auth-manager';
import { encrypt } from '../core/crypto-utils';
import { AppError, ERROR_CODES } from '../errors';
import {
  AUTH_SESSION_SCHEMA_VERSION,
  AuthSessionStore,
} from '../infra/auth-session-store';
import {
  KEYCHAIN_ENCRYPTION_KEY,
  KEYCHAIN_MNEMONIC_KEY,
  KEYCHAIN_PASSPHRASE_STATE_KEY,
} from '../signer';

import type {
  AppTransferLoginResult,
  AuthSessionMetadata,
} from '../core/auth/auth-types';
import type { TransferPayloadHandler } from '../core/prime-transfer/transfer-types';
import type {
  ISecureStorage,
  SecureStorageBackend,
} from '../infra/keychain-storage';
import type { ISigner } from '../signer/types';

jest.mock('../core/auth/app-transfer-payload', () => {
  const actual = jest.requireActual<
    typeof import('../core/auth/app-transfer-payload')
  >('../core/auth/app-transfer-payload');
  return {
    ...actual,
    extractBotWalletMnemonicFromTransferData: jest.fn(
      actual.extractBotWalletMnemonicFromTransferData,
    ),
  };
});

class InMemorySecureStorage implements ISecureStorage {
  private readonly store = new Map<string, Buffer>();

  private readonly backendType: SecureStorageBackend;

  constructor(backendType: SecureStorageBackend = 'macos-keychain') {
    this.backendType = backendType;
  }

  getBackendType(): SecureStorageBackend {
    return this.backendType;
  }

  async get(key: string): Promise<Buffer | null> {
    const value = this.store.get(key);
    return value ? Buffer.from(value) : null;
  }

  async set(key: string, value: Buffer): Promise<void> {
    this.store.set(key, Buffer.from(value));
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}

function createCleanupFailingSecureStorage(): ISecureStorage {
  const storage = new InMemorySecureStorage();

  return {
    getBackendType: () => storage.getBackendType(),
    get: (key) => storage.get(key),
    set: (key, value) => storage.set(key, value),
    delete: async (key) => {
      if (key === KEYCHAIN_MNEMONIC_KEY) {
        throw new AppError(
          ERROR_CODES.SEC_STORAGE_ERROR.code,
          'cleanup failed',
          'retry',
        );
      }

      await storage.delete(key);
    },
  };
}

function createHardwareCleanupFailingSecureStorage(): ISecureStorage {
  const storage = new InMemorySecureStorage();

  return {
    getBackendType: () => storage.getBackendType(),
    get: (key) => storage.get(key),
    set: (key, value) => storage.set(key, value),
    delete: async (key) => {
      if (key === KEYCHAIN_PASSPHRASE_STATE_KEY) {
        throw new AppError(
          ERROR_CODES.SEC_STORAGE_ERROR.code,
          'hardware cleanup failed',
          'Unlock or grant access to the OS keychain, then retry logout.',
        );
      }

      await storage.delete(key);
    },
  };
}

function createPartiallyFailingReadSecureStorage(
  mnemonicBuffer: Buffer,
): ISecureStorage {
  return {
    getBackendType(): SecureStorageBackend {
      return 'macos-keychain';
    },
    async get(key: string): Promise<Buffer | null> {
      if (key === KEYCHAIN_MNEMONIC_KEY) {
        return mnemonicBuffer;
      }

      if (key === KEYCHAIN_ENCRYPTION_KEY) {
        throw new AppError(
          ERROR_CODES.SEC_STORAGE_ERROR.code,
          'lookup failed',
          'retry',
        );
      }

      return null;
    },
    async set(_key: string, _value: Buffer): Promise<void> {
      return undefined;
    },
    async delete(_key: string): Promise<void> {
      return undefined;
    },
  };
}

function createMockSigner(
  address = '0x1234567890abcdef1234567890abcdef12345678',
): ISigner {
  return {
    async getAddress(
      _networkId: Parameters<ISigner['getAddress']>[0],
    ): Promise<Awaited<ReturnType<ISigner['getAddress']>>> {
      return {
        address,
        path: "m/44'/60'/0'/0/0",
        publicKey: '0x',
      } as Awaited<ReturnType<ISigner['getAddress']>>;
    },
    async signTransaction(
      _payload: Parameters<ISigner['signTransaction']>[0],
    ): Promise<never> {
      throw new AppError('TEST_NOT_IMPLEMENTED', 'not implemented', 'retry');
    },
    async signMessage(
      _payload: Parameters<ISigner['signMessage']>[0],
    ): Promise<never> {
      throw new AppError('TEST_NOT_IMPLEMENTED', 'not implemented', 'retry');
    },
  };
}

function makeSession(
  overrides?: Partial<AuthSessionMetadata>,
): AuthSessionMetadata {
  return {
    schemaVersion: AUTH_SESSION_SCHEMA_VERSION,
    loginMethod: 'app_transfer',
    walletKind: 'hd',
    displayAddress: '0x1234567890abcdef1234567890abcdef12345678',
    importedAt: '2026-04-06T05:35:44.000Z',
    sourceLabel: 'Bot Wallet (abcd1234)',
    ...overrides,
  };
}

function makePairingResult(): AppTransferLoginResult {
  return {
    status: 'pairing',
    loginMethod: 'app_transfer',
    pairingCode: 'ABCDEFGH123-ABCDE-FGHIJ-KLMNP-QRSTU-VWXYZ-12345-6789A',
    createdAt: '2026-04-06T07:00:00.000Z',
    timeoutMs: 120_000,
    expiresAt: '2026-04-06T07:02:00.000Z',
    pairingPayload: {
      roomId: 'ABCDEFGH123',
      transferType: EPrimeTransferDataType.keylessWallet,
      serverType: EPrimeTransferServerType.OFFICIAL,
      websocketEndpoint: 'wss://transfer.onekeytest.com',
      uri: 'onekey-wallet://cross-device-transfer/?code=ABCDEFGH123-ABCDE-FGHIJ-KLMNP-QRSTU-VWXYZ-12345-6789A',
      verifyString: 'OneKeyPrimeTransfer',
    },
  };
}

let tempDir: string;
let sessionPath: string;

const mockedExtractBotWalletMnemonic = jest.mocked(
  appTransferPayloadModule.extractBotWalletMnemonicFromTransferData,
);

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'auth-manager-'));
  sessionPath = join(tempDir, 'auth-session.json');
  mockedExtractBotWalletMnemonic.mockImplementation(
    jest.requireActual<typeof import('../core/auth/app-transfer-payload')>(
      '../core/auth/app-transfer-payload',
    ).extractBotWalletMnemonicFromTransferData,
  );
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  mockedExtractBotWalletMnemonic.mockReset();
});

describe('AuthManager', () => {
  const VALID_MNEMONIC =
    'test test test test test test test test test test test junk';
  const APP_TRANSFER_SOURCE_LABEL = 'Bot Wallet (7038aa6c)';

  it('persists secrets separately from metadata and resolves authenticated status', async () => {
    const storage = new InMemorySecureStorage();
    const sessionStore = new AuthSessionStore(sessionPath);
    const manager = new AuthManager(storage, sessionStore);
    const session = makeSession();

    const result = await manager.persistSession({
      encryptedMnemonic: Buffer.from('ciphertext'),
      encryptionKey: 'encryption-key',
      session,
    });

    expect(storage.has(KEYCHAIN_MNEMONIC_KEY)).toBe(true);
    expect(storage.has(KEYCHAIN_ENCRYPTION_KEY)).toBe(true);
    expect(result).toMatchObject({
      authStatus: 'authenticated',
      displayAddress: session.displayAddress,
      loginMethod: session.loginMethod,
      sourceLabel: session.sourceLabel,
      storageBackend: 'macos-keychain',
    });

    const raw = JSON.parse(readFileSync(sessionPath, 'utf-8')) as Record<
      string,
      unknown
    >;
    expect(raw).not.toHaveProperty('mnemonic');
    expect(raw).not.toHaveProperty('encryption_key');
  });

  it('rolls back secrets and metadata when session metadata persistence fails', async () => {
    const storage = new InMemorySecureStorage();
    const clear = jest.fn(async () => {});
    const sessionStore = {
      load: jest.fn(async () => null),
      save: jest.fn(async () => {
        throw new AppError(
          'AUTH_SESSION_PERSIST_FAILED',
          'write failed',
          'retry',
        );
      }),
      clear,
    } as unknown as AuthSessionStore;
    const manager = new AuthManager(storage, sessionStore);

    await expect(
      manager.persistSession({
        encryptedMnemonic: Buffer.from('ciphertext'),
        encryptionKey: 'encryption-key',
        session: makeSession(),
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_SESSION_PERSIST_FAILED',
    });

    expect(storage.has(KEYCHAIN_MNEMONIC_KEY)).toBe(false);
    expect(storage.has(KEYCHAIN_ENCRYPTION_KEY)).toBe(false);
    expect(clear).toHaveBeenCalled();
  });

  it('reports authenticated status when secrets exist but metadata is missing', async () => {
    const storage = new InMemorySecureStorage('linux-secret-service');
    await storage.set(KEYCHAIN_MNEMONIC_KEY, Buffer.from('ciphertext'));
    await storage.set(KEYCHAIN_ENCRYPTION_KEY, Buffer.from('encryption-key'));

    const manager = new AuthManager(storage, new AuthSessionStore(sessionPath));

    await expect(manager.getStatus()).resolves.toMatchObject({
      authStatus: 'authenticated',
      storageBackend: 'linux-secret-service',
    });
  });

  it('clears secure storage secrets and metadata together', async () => {
    const storage = new InMemorySecureStorage();
    const sessionStore = new AuthSessionStore(sessionPath);
    const manager = new AuthManager(storage, sessionStore);

    await manager.persistSession({
      encryptedMnemonic: Buffer.from('ciphertext'),
      encryptionKey: 'encryption-key',
      session: makeSession(),
    });

    await manager.clearSession();

    expect(storage.has(KEYCHAIN_MNEMONIC_KEY)).toBe(false);
    expect(storage.has(KEYCHAIN_ENCRYPTION_KEY)).toBe(false);
    await expect(sessionStore.load()).resolves.toBeNull();
  });

  it('propagates cleanup failures instead of reporting logout success', async () => {
    const storage = createCleanupFailingSecureStorage();
    const sessionStore = new AuthSessionStore(sessionPath);
    const manager = new AuthManager(storage, sessionStore);

    await manager.persistSession({
      encryptedMnemonic: Buffer.from('ciphertext'),
      encryptionKey: 'encryption-key',
      session: makeSession(),
    });

    await expect(manager.clearSession()).rejects.toMatchObject({
      code: ERROR_CODES.SEC_STORAGE_ERROR.code,
    });
  });

  it('keeps session metadata when hardware key cleanup fails', async () => {
    const sessionStore = new AuthSessionStore(sessionPath);
    const manager = new AuthManager(
      createHardwareCleanupFailingSecureStorage(),
      sessionStore,
    );

    await sessionStore.save(
      makeSession({
        loginMethod: 'hardware',
        walletKind: 'hw',
        sourceLabel: 'Hardware: OneKey Touch',
        device: {
          connectId: 'connect-123',
          deviceId: 'device-xyz',
          deviceLabel: 'OneKey Touch',
        },
        passphraseMode: 'on_host',
      }),
    );

    await expect(manager.clearSession()).rejects.toMatchObject({
      code: ERROR_CODES.SEC_STORAGE_ERROR.code,
    });
    await expect(sessionStore.load()).resolves.toMatchObject({
      loginMethod: 'hardware',
      walletKind: 'hw',
      passphraseMode: 'on_host',
    });
  });

  it('wipes already-loaded secrets when a later secure storage read fails', async () => {
    const mnemonicBuffer = Buffer.from('ciphertext');
    const manager = new AuthManager(
      createPartiallyFailingReadSecureStorage(mnemonicBuffer),
      new AuthSessionStore(sessionPath),
    );

    await expect(manager.getStatus()).rejects.toMatchObject({
      code: ERROR_CODES.SEC_STORAGE_ERROR.code,
    });
    expect([...mnemonicBuffer].every((byte) => byte === 0)).toBe(true);
  });

  it('starts app transfer login through the shared auth core when no active wallet exists', async () => {
    const storage = new InMemorySecureStorage();
    const sessionStore = new AuthSessionStore(sessionPath);
    const appTransferLogin = jest.fn(async (_input: unknown, _deps: unknown) =>
      makePairingResult(),
    );
    const manager = new AuthManager(
      storage,
      sessionStore,
      jest.fn<Promise<ISigner>, [string]>(async () => createMockSigner()),
      appTransferLogin,
    );

    const result = await manager.startAppTransferLogin({
      endpointEnv: 'test',
    });

    expect(result).toEqual(makePairingResult());
    expect(appTransferLogin).toHaveBeenCalledWith(
      {
        endpointEnv: 'test',
      },
      expect.objectContaining({
        onTransferData: expect.any(Function),
      }),
    );
  });

  it('rejects app transfer login when an active wallet already exists', async () => {
    const storage = new InMemorySecureStorage();
    const sessionStore = new AuthSessionStore(sessionPath);
    await storage.set(KEYCHAIN_MNEMONIC_KEY, Buffer.from('ciphertext'));
    await storage.set(KEYCHAIN_ENCRYPTION_KEY, Buffer.from('encryption-key'));
    await sessionStore.save(makeSession());

    const appTransferLogin = jest.fn(async (_input: unknown, _deps: unknown) =>
      makePairingResult(),
    );
    const manager = new AuthManager(
      storage,
      sessionStore,
      jest.fn<Promise<ISigner>, [string]>(async () => createMockSigner()),
      appTransferLogin,
    );

    await expect(
      manager.startAppTransferLogin({
        endpointEnv: 'test',
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_WALLET_EXISTS.code,
    });
    expect(appTransferLogin).not.toHaveBeenCalled();
  });

  it('persists app transfer sessions through the shared mnemonic import core', async () => {
    const storage = new InMemorySecureStorage();
    const sessionStore = new AuthSessionStore(sessionPath);
    const signerFactory = jest.fn<Promise<ISigner>, [string]>(async () =>
      createMockSigner('0x9999999999999999999999999999999999999999'),
    );
    const appTransferLogin = jest.fn(
      async (
        _input: unknown,
        deps: {
          onTransferData: TransferPayloadHandler;
        },
      ) => {
        const transferData = {
          privateData: {
            credentials: {},
            decryptedCredentials: {
              'hd-bot--parent-1--0': mnemonicToRevealableSeed(VALID_MNEMONIC),
            },
            importedAccounts: {},
            watchingAccounts: {},
            wallets: {
              'hd-bot--parent-1--0': {
                id: 'hd-bot--parent-1--0',
              },
            },
          },
          publicData: undefined,
          isEmptyData: false,
          isWatchingOnly: false,
          appVersion: '1.0.0',
        } as unknown as IPrimeTransferData;

        await deps.onTransferData(transferData, {
          assertSessionIsActive() {},
        });
        return makePairingResult();
      },
    );
    const manager = new AuthManager(
      storage,
      sessionStore,
      signerFactory,
      appTransferLogin,
    );

    const result = await manager.startAppTransferLogin({
      endpointEnv: 'test',
    });

    expect(result).toEqual(makePairingResult());
    expect(storage.has(KEYCHAIN_MNEMONIC_KEY)).toBe(true);
    expect(storage.has(KEYCHAIN_ENCRYPTION_KEY)).toBe(true);
    await expect(sessionStore.load()).resolves.toMatchObject({
      loginMethod: 'app_transfer',
      sourceLabel: APP_TRANSFER_SOURCE_LABEL,
      displayAddress: '0x9999999999999999999999999999999999999999',
    });
    expect(signerFactory).toHaveBeenCalledWith('evm');
  });

  it('rebuilds the app transfer source label from stored mnemonic for existing sessions', async () => {
    const storage = new InMemorySecureStorage();
    const sessionStore = new AuthSessionStore(sessionPath);
    const encryptionKey = 'existing-session-encryption-key';
    const encryptedMnemonic = await encrypt(
      Buffer.from(VALID_MNEMONIC, 'utf-8'),
      encryptionKey,
    );

    await storage.set(KEYCHAIN_MNEMONIC_KEY, encryptedMnemonic);
    await storage.set(KEYCHAIN_ENCRYPTION_KEY, Buffer.from(encryptionKey));
    await sessionStore.save(
      makeSession({
        loginMethod: 'app_transfer',
        displayAddress: '0x9999999999999999999999999999999999999999',
        sourceLabel: 'Bot Wallet via App Transfer',
      }),
    );

    const manager = new AuthManager(storage, sessionStore);

    await expect(manager.getStatus()).resolves.toMatchObject({
      authStatus: 'authenticated',
      loginMethod: 'app_transfer',
      sourceLabel: APP_TRANSFER_SOURCE_LABEL,
      displayAddress: '0x9999999999999999999999999999999999999999',
    });
  });

  it('rolls back a persisted app transfer session if the runtime times out before completion', async () => {
    const storage = new InMemorySecureStorage();
    const sessionStore = new AuthSessionStore(sessionPath);
    const manager = new AuthManager(
      storage,
      sessionStore,
      jest.fn<Promise<ISigner>, [string]>(async () =>
        createMockSigner('0x9999999999999999999999999999999999999999'),
      ),
      jest.fn(
        async (
          _input: unknown,
          deps: {
            onTransferData: TransferPayloadHandler;
          },
        ) => {
          const transferData = {
            privateData: {
              credentials: {},
              decryptedCredentials: {
                'hd-bot--parent-1--0': mnemonicToRevealableSeed(VALID_MNEMONIC),
              },
              importedAccounts: {},
              watchingAccounts: {},
              wallets: {
                'hd-bot--parent-1--0': {
                  id: 'hd-bot--parent-1--0',
                },
              },
            },
            publicData: undefined,
            isEmptyData: false,
            isWatchingOnly: false,
            appVersion: '1.0.0',
          } as unknown as IPrimeTransferData;

          await deps.onTransferData(transferData, {
            assertSessionIsActive() {
              throw new AppError(
                ERROR_CODES.AUTH_TRANSFER_TIMEOUT.code,
                'Transfer timed out.',
                'Retry the App Transfer login flow',
              );
            },
          });

          return makePairingResult();
        },
      ),
    );

    await expect(
      manager.startAppTransferLogin({
        endpointEnv: 'test',
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_TRANSFER_TIMEOUT.code,
    });

    expect(storage.has(KEYCHAIN_MNEMONIC_KEY)).toBe(false);
    expect(storage.has(KEYCHAIN_ENCRYPTION_KEY)).toBe(false);
    await expect(sessionStore.load()).resolves.toBeNull();
  });

  it('rejects app_transfer payload carrying an invalid mnemonic', async () => {
    mockedExtractBotWalletMnemonic.mockReturnValueOnce('not a valid mnemonic');

    const storage = new InMemorySecureStorage();
    const sessionStore = new AuthSessionStore(sessionPath);
    const manager = new AuthManager(
      storage,
      sessionStore,
      jest.fn<Promise<ISigner>, [string]>(async () => createMockSigner()),
      jest.fn(
        async (
          _input: unknown,
          deps: {
            onTransferData: TransferPayloadHandler;
          },
        ) => {
          const transferData = {
            privateData: {
              credentials: {},
              decryptedCredentials: {
                'hd-bot--parent-1--0': mnemonicToRevealableSeed(VALID_MNEMONIC),
              },
              importedAccounts: {},
              watchingAccounts: {},
              wallets: {
                'hd-bot--parent-1--0': {
                  id: 'hd-bot--parent-1--0',
                },
              },
            },
            publicData: undefined,
            isEmptyData: false,
            isWatchingOnly: false,
            appVersion: '1.0.0',
          } as unknown as IPrimeTransferData;

          await deps.onTransferData(transferData, {
            assertSessionIsActive() {},
          });

          return makePairingResult();
        },
      ),
    );

    await expect(
      manager.startAppTransferLogin({
        endpointEnv: 'test',
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.PARAM_INVALID_MNEMONIC.code,
    });

    expect(storage.has(KEYCHAIN_MNEMONIC_KEY)).toBe(false);
    expect(storage.has(KEYCHAIN_ENCRYPTION_KEY)).toBe(false);
    await expect(sessionStore.load()).resolves.toBeNull();
  });
});
