/* oxlint-disable @cspell/spellchecker */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { AppError, ERROR_CODES } from '../../errors';

import type { ISecureStorage, SecureStorageBackend } from './types';

const SERVICE_NAME = 'onekey-cli';
export const NAPI_RS_KEYRING_ACCOUNT_PREFIX = 'napi-rs/';
const NAPI_RS_KEYRING_PACKAGE_NAME = '@napi-rs/keyring';
const NAPI_RS_KEYRING_SEA_ASSET_KEY = 'onekey-cli/keyring-native.node';
const requireFromCliRuntime = createRequire(
  process.env.ONEKEY_CLI_STANDALONE === '1' ? process.execPath : __filename,
);
const requireFromSourceFile = createRequire(__filename);

type IKeyringEntry = {
  getPassword(): Promise<string | null | undefined>;
  setPassword(password: string): Promise<void>;
  deletePassword(): Promise<unknown>;
};

type IKeyringModule = {
  AsyncEntry: new (service: string, account: string) => IKeyringEntry;
};

type ISeaModule = typeof import('node:sea');

export type IKeyringModuleLoader = () => Promise<IKeyringModule>;

export type INapiRsKeyringSecureStorageOptions = {
  keyringModuleLoader?: IKeyringModuleLoader;
  platform?: NodeJS.Platform;
};

const NAPI_RS_KEYRING_SUPPORTED_CLI_ARCHES_BY_PLATFORM: Partial<
  Record<NodeJS.Platform, ReadonlySet<NodeJS.Architecture>>
> = {
  darwin: new Set(['arm64', 'x64']),
  linux: new Set(['arm', 'arm64', 'riscv64', 'x64']),
  win32: new Set(['arm64', 'ia32', 'x64']),
};

export function isNapiRsKeyringSupportedCliRuntime(
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture = process.arch,
): boolean {
  return (
    NAPI_RS_KEYRING_SUPPORTED_CLI_ARCHES_BY_PLATFORM[platform]?.has(arch) ??
    false
  );
}

function loadSeaModule(): ISeaModule | null {
  try {
    return requireFromSourceFile('node:sea') as ISeaModule;
  } catch {
    return null;
  }
}

function toBuffer(arrayBuffer: ArrayBuffer): Buffer {
  return Buffer.from(new Uint8Array(arrayBuffer));
}

function getSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function removeFileIfExists(filePath: string): void {
  try {
    unlinkSync(filePath);
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code !== 'ENOENT') {
      throw error;
    }
  }
}

function writeFileAtomically(filePath: string, contents: Buffer): void {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tempPath, contents, { mode: 0o755 });
    renameSync(tempPath, filePath);
  } catch (error) {
    removeFileIfExists(tempPath);
    throw error;
  }
}

function ensureExtractedSeaAsset(filePath: string, contents: Buffer): void {
  const expectedHash = getSha256(contents);

  if (existsSync(filePath)) {
    const actualHash = getSha256(readFileSync(filePath));
    if (actualHash === expectedHash) {
      return;
    }
  }

  mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
  writeFileAtomically(filePath, contents);
}

function getStandaloneKeyringNativeBindingPath(): string | null {
  if (
    process.env.ONEKEY_CLI_STANDALONE !== '1' ||
    process.platform !== 'darwin'
  ) {
    return null;
  }

  const sea = loadSeaModule();
  if (!sea?.isSea()) {
    return null;
  }

  const nativeBinding = toBuffer(
    sea.getRawAsset(NAPI_RS_KEYRING_SEA_ASSET_KEY),
  );
  const nativeBindingHash = getSha256(nativeBinding);
  const nativeBindingPath = join(
    tmpdir(),
    'onekey-cli',
    'sea-assets',
    nativeBindingHash,
    `keyring.darwin-${process.arch}.node`,
  );

  ensureExtractedSeaAsset(nativeBindingPath, nativeBinding);
  return nativeBindingPath;
}

async function defaultKeyringModuleLoader(): Promise<IKeyringModule> {
  const standaloneNativeBindingPath = getStandaloneKeyringNativeBindingPath();
  if (standaloneNativeBindingPath) {
    return requireFromCliRuntime(standaloneNativeBindingPath) as IKeyringModule;
  }

  const keyringModule = requireFromCliRuntime(NAPI_RS_KEYRING_PACKAGE_NAME);
  return keyringModule as IKeyringModule;
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    const err = error as Error & {
      code?: number | string;
      stderr?: string;
    };
    return [err.code, err.stderr, err.message]
      .filter((part) => part !== undefined && part !== '')
      .join(' ');
  }

  return String(error);
}

export class NapiRsKeyringSecureStorage implements ISecureStorage {
  private readonly keyringModuleLoader: IKeyringModuleLoader;

  private readonly platform: NodeJS.Platform;

  constructor(options: INapiRsKeyringSecureStorageOptions = {}) {
    this.keyringModuleLoader =
      options.keyringModuleLoader ?? defaultKeyringModuleLoader;
    this.platform = options.platform ?? process.platform;
  }

  getBackendType(): SecureStorageBackend {
    if (this.platform === 'darwin') {
      return 'macos-keychain';
    }
    if (this.platform === 'linux') {
      return 'linux-secret-service';
    }
    if (this.platform === 'win32') {
      return 'windows-credential-manager';
    }

    throw new AppError(
      ERROR_CODES.SEC_STORAGE_BACKEND_UNAVAILABLE.code,
      `Secure storage is not supported on platform "${this.platform}".`,
      'Use macOS Keychain, Linux Secret Service, or Windows Credential Manager to store wallet secrets.',
      { details: { platform: this.platform } },
    );
  }

  async set(key: string, value: Buffer): Promise<void> {
    try {
      const entry = await this.createEntry(key);
      await entry.setPassword(value.toString('hex'));
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const entry = await this.createEntry(key);
      const hex = (await entry.getPassword()) ?? null;
      return hex ? Buffer.from(hex, 'hex') : null;
    } catch (error) {
      if (this.isItemNotFound(error)) {
        return null;
      }
      throw this.mapError(error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const entry = await this.createEntry(key);
      await entry.deletePassword();
    } catch (error) {
      if (this.isItemNotFound(error)) {
        return;
      }
      throw this.mapError(error);
    }
  }

  private async createEntry(key: string): Promise<IKeyringEntry> {
    const { AsyncEntry } = await this.keyringModuleLoader();
    return new AsyncEntry(
      SERVICE_NAME,
      `${NAPI_RS_KEYRING_ACCOUNT_PREFIX}${key}`,
    );
  }

  private isItemNotFound(error: unknown): boolean {
    const errorText = getErrorText(error).toLowerCase();
    return (
      errorText.includes('noentry') ||
      errorText.includes('no entry') ||
      errorText.includes('no matching entry') ||
      errorText.includes('not found') ||
      errorText.includes('could not be found')
    );
  }

  private mapError(error: unknown): AppError {
    const lowerErrorText = getErrorText(error).toLowerCase();

    if (
      this.platform === 'darwin' &&
      (lowerErrorText.includes('user interaction is not allowed') ||
        lowerErrorText.includes('errsecinteractionnotallowed'))
    ) {
      return new AppError(
        ERROR_CODES.SEC_KEYCHAIN_LOCKED.code,
        'Keychain is locked. Unlock your Mac and try again.',
        'Run: security unlock-keychain',
        { cause: error },
      );
    }

    if (
      lowerErrorText.includes('denied') ||
      lowerErrorText.includes('not allowed')
    ) {
      if (this.platform === 'darwin') {
        return new AppError(
          ERROR_CODES.SEC_KEYCHAIN_ACCESS_DENIED.code,
          'Keychain access was denied.',
          'Grant access in macOS Keychain Access and try again.',
          { cause: error },
        );
      }

      return new AppError(
        ERROR_CODES.SEC_STORAGE_ACCESS_DENIED.code,
        'Secure storage access was denied.',
        'Grant secure storage access and try again.',
        { cause: error },
      );
    }

    if (
      lowerErrorText.includes('cannot find native binding') ||
      lowerErrorText.includes('cannot find module') ||
      lowerErrorText.includes('unsupported os') ||
      lowerErrorText.includes('unsupported architecture')
    ) {
      return new AppError(
        ERROR_CODES.SEC_STORAGE_BACKEND_UNAVAILABLE.code,
        'Native keyring backend is unavailable.',
        'Install the supported @napi-rs/keyring native package for this platform and retry.',
        { cause: error },
      );
    }

    if (this.platform === 'darwin') {
      return new AppError(
        ERROR_CODES.SEC_KEYCHAIN_ERROR.code,
        'Keychain operation failed.',
        'Check macOS Keychain Access and retry.',
        { cause: error },
      );
    }

    return new AppError(
      ERROR_CODES.SEC_STORAGE_ERROR.code,
      'Secure storage operation failed.',
      'Check the OS secure storage backend and retry.',
      { cause: error },
    );
  }
}
