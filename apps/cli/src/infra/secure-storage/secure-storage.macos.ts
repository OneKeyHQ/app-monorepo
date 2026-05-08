import { AppError, ERROR_CODES } from '../../errors';

import { defaultProcessRunner } from './process-utils';

import type {
  IProcessRunner,
  ISecureStorage,
  SecureStorageBackend,
} from './types';

const SERVICE_NAME = 'onekey-cli';

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

export class MacOSSecureStorage implements ISecureStorage {
  private readonly runner: IProcessRunner;

  constructor(runner: IProcessRunner = defaultProcessRunner) {
    this.runner = runner;
  }

  getBackendType(): SecureStorageBackend {
    return 'macos-keychain';
  }

  async set(key: string, value: Buffer): Promise<void> {
    const hex = value.toString('hex');
    await this.setWithSecurityCli(key, hex);
  }

  async get(key: string): Promise<Buffer | null> {
    const hex = await this.getWithSecurityCli(key);
    return hex ? Buffer.from(hex, 'hex') : null;
  }

  async delete(key: string): Promise<void> {
    await this.deleteWithSecurityCli(key);
  }

  private async setWithSecurityCli(key: string, hex: string): Promise<void> {
    try {
      // `security -i` reads the command from stdin, so the password never
      // appears in argv (unlike `-w <hex>`, visible via `ps aux`).
      // All three interpolated values are safe for security's parser:
      // fixed service constant, literal account key, hex-only password.
      const cmd = `add-generic-password -s "${SERVICE_NAME}" -a "${key}" -w "${hex}" -U`;
      await this.runner.spawnWithStdin('security', ['-i'], cmd);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private async getWithSecurityCli(key: string): Promise<string | null> {
    try {
      const { stdout } = await this.runner.execFileAsync('security', [
        'find-generic-password',
        '-s',
        SERVICE_NAME,
        '-a',
        key,
        '-w',
      ]);
      const hex = stdout.trim();
      return hex || null;
    } catch (error) {
      if (this.isSecurityItemNotFound(error)) {
        return null;
      }
      throw this.mapError(error);
    }
  }

  private async deleteWithSecurityCli(key: string): Promise<void> {
    try {
      await this.runner.execFileAsync('security', [
        'delete-generic-password',
        '-s',
        SERVICE_NAME,
        '-a',
        key,
      ]);
    } catch (error) {
      if (this.isSecurityItemNotFound(error)) {
        return;
      }
      throw this.mapError(error);
    }
  }

  private isSecurityItemNotFound(error: unknown): boolean {
    const err = error as Error & { code?: number; stderr?: string };
    return (
      err.code === 44 || err.stderr?.includes('could not be found') === true
    );
  }

  private mapError(error: unknown): AppError {
    const err = error as Error & { code?: number; stderr?: string };
    const lowerErrorText = getErrorText(error).toLowerCase();

    if (
      err.code === 36 ||
      lowerErrorText.includes('user interaction is not allowed') ||
      lowerErrorText.includes('errsecinteractionnotallowed')
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
      return new AppError(
        ERROR_CODES.SEC_KEYCHAIN_ACCESS_DENIED.code,
        'Keychain access was denied.',
        'Grant access in macOS Keychain Access and try again.',
        { cause: error },
      );
    }

    return new AppError(
      ERROR_CODES.SEC_KEYCHAIN_ERROR.code,
      'Keychain operation failed.',
      'Check macOS Keychain Access and retry.',
      { cause: error },
    );
  }
}
