import fs from 'node:fs/promises';
import path from 'node:path';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { secureWipe as defaultSecureWipe } from '../../core/crypto-utils';
import { KeychainStorage } from '../keychain-storage';

import { deserialize, serialize } from './codec';
import { VaultClientError } from './errors';
import { assertVaultInvariants } from './invariants';
import { acquireVaultLock } from './lock';
import {
  deriveVaultKeyFromMasterKey as defaultDeriveVaultKeyFromMasterKey,
  readMasterKey,
} from './master-key';
import { MASTER_KEY_ACCOUNT, VAULT_DIR, VAULT_FILE, VAULT_LOCK } from './paths';

import type { IVaultLockRelease } from './lock';
import type { IVaultPlaintext } from './types';
import type { FileHandle } from 'node:fs/promises';

export type IVaultMutationResult<TResult> = {
  nextVault: IVaultPlaintext;
  result: TResult;
  shouldWrite?: boolean;
};

export type IVaultClientPaths = {
  vaultDir: string;
  vaultFile: string;
  vaultLock: string;
  masterKeyAccount: string;
};

type IKeychainStorageLike = Pick<KeychainStorage, 'delete' | 'get' | 'set'>;
type ISecureWipe = (buffer: Buffer) => void;
type IDeriveVaultKeyFromMasterKey = (
  masterKey: Buffer,
  secureWipe?: ISecureWipe,
) => Buffer;

type IVaultClientOptions = {
  keychainStorage?: IKeychainStorageLike;
  paths?: Partial<IVaultClientPaths>;
  acquireLock?: (paths: IVaultClientPaths) => Promise<IVaultLockRelease>;
  writeFileAtomic?: (filePath: string, data: Buffer) => Promise<void>;
  secureWipe?: ISecureWipe;
  deriveVaultKeyFromMasterKey?: IDeriveVaultKeyFromMasterKey;
};

async function syncParentDirectory(filePath: string): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    handle = await fs.open(path.dirname(filePath), 'r');
    await handle.sync();
  } catch {
    // Directory fsync is best-effort because some filesystems reject it.
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function defaultWriteFileAtomic(
  filePath: string,
  data: Buffer,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const handle = await fs.open(tempPath, 'w');

  try {
    await handle.writeFile(data);
    await handle.sync();
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined);
    throw error;
  } finally {
    await handle.close();
  }

  await fs.rename(tempPath, filePath);
  await syncParentDirectory(filePath);
}

function toVaultClientError(error: unknown): Error {
  if (error instanceof VaultClientError) {
    return error;
  }
  if (
    error instanceof Error &&
    'code' in error &&
    error.code === 'VAULT_CORRUPT'
  ) {
    return new VaultClientError('VAULT_CORRUPT');
  }
  return error instanceof Error ? error : new OneKeyLocalError(String(error));
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

async function readVaultFile(filePath: string): Promise<Buffer> {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) {
      throw new VaultClientError('VAULT_MISSING');
    }
    throw error;
  }
}

async function unlinkIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) {
      return;
    }
    throw error;
  }
}

export class VaultClient {
  private readonly keychainStorage: IKeychainStorageLike;

  private readonly paths: IVaultClientPaths;

  private readonly acquireLock: (
    paths: IVaultClientPaths,
  ) => Promise<IVaultLockRelease>;

  private readonly writeFileAtomic: (
    filePath: string,
    data: Buffer,
  ) => Promise<void>;

  private readonly secureWipe: ISecureWipe;

  private readonly deriveVaultKeyFromMasterKey: IDeriveVaultKeyFromMasterKey;

  constructor(options: IVaultClientOptions = {}) {
    this.keychainStorage = options.keychainStorage ?? new KeychainStorage();
    this.paths = {
      vaultDir: options.paths?.vaultDir ?? VAULT_DIR,
      vaultFile: options.paths?.vaultFile ?? VAULT_FILE,
      vaultLock: options.paths?.vaultLock ?? VAULT_LOCK,
      masterKeyAccount: options.paths?.masterKeyAccount ?? MASTER_KEY_ACCOUNT,
    };
    this.acquireLock =
      options.acquireLock ??
      ((pathsValue) =>
        acquireVaultLock({
          vaultDir: pathsValue.vaultDir,
          vaultFile: pathsValue.vaultFile,
          vaultLock: pathsValue.vaultLock,
        }));
    this.writeFileAtomic = options.writeFileAtomic ?? defaultWriteFileAtomic;
    this.secureWipe = options.secureWipe ?? defaultSecureWipe;
    this.deriveVaultKeyFromMasterKey =
      options.deriveVaultKeyFromMasterKey ?? defaultDeriveVaultKeyFromMasterKey;
  }

  async atomicMutate<TResult>(
    mutator: (
      currentVault: IVaultPlaintext,
    ) => Promise<IVaultMutationResult<TResult>> | IVaultMutationResult<TResult>,
  ): Promise<TResult> {
    const release = await this.acquireLock(this.paths);
    let vaultKey: Buffer | undefined;

    try {
      vaultKey = await this.getVaultKey();
      const currentVault = await this.loadVault(vaultKey);
      const { nextVault, result, shouldWrite } = await mutator(currentVault);
      assertVaultInvariants(nextVault);
      if (shouldWrite !== false) {
        try {
          await this.writeFileAtomic(
            this.paths.vaultFile,
            serialize(nextVault, vaultKey),
          );
        } catch (error) {
          throw new VaultClientError('VAULT_WRITE_FAILED', { cause: error });
        }
      }
      return result;
    } catch (error) {
      throw toVaultClientError(error);
    } finally {
      if (vaultKey) {
        this.secureWipe(vaultKey);
      }
      await release();
    }
  }

  async readOnly<TResult>(
    reader: (currentVault: IVaultPlaintext) => Promise<TResult> | TResult,
  ): Promise<TResult> {
    const release = await this.acquireLock(this.paths);
    let vaultKey: Buffer | undefined;

    try {
      vaultKey = await this.getVaultKey();
      const currentVault = await this.loadVault(vaultKey);
      return await reader(currentVault);
    } catch (error) {
      throw toVaultClientError(error);
    } finally {
      if (vaultKey) {
        this.secureWipe(vaultKey);
      }
      await release();
    }
  }

  async initialize(nextVault: IVaultPlaintext): Promise<void> {
    const release = await this.acquireLock(this.paths);
    let vaultKey: Buffer | undefined;

    try {
      vaultKey = await this.getVaultKey();
      assertVaultInvariants(nextVault);
      try {
        await this.writeFileAtomic(
          this.paths.vaultFile,
          serialize(nextVault, vaultKey),
        );
      } catch (error) {
        throw new VaultClientError('VAULT_WRITE_FAILED', { cause: error });
      }
    } catch (error) {
      throw toVaultClientError(error);
    } finally {
      if (vaultKey) {
        this.secureWipe(vaultKey);
      }
      await release();
    }
  }

  async destroy(): Promise<void> {
    await this.keychainStorage.delete(this.paths.masterKeyAccount);
    await unlinkIfExists(this.paths.vaultFile);
    await unlinkIfExists(this.paths.vaultLock);
  }

  private async getVaultKey(): Promise<Buffer> {
    const masterKey = await readMasterKey({
      keychainStorage: this.keychainStorage,
      account: this.paths.masterKeyAccount,
    });
    if (!masterKey) {
      throw new VaultClientError('NOT_AUTHENTICATED');
    }

    return this.deriveVaultKeyFromMasterKey(masterKey, this.secureWipe);
  }

  private async loadVault(vaultKey: Buffer): Promise<IVaultPlaintext> {
    const vaultFile = await readVaultFile(this.paths.vaultFile);
    const vault = deserialize(vaultFile, vaultKey);
    assertVaultInvariants(vault);
    return vault;
  }
}
