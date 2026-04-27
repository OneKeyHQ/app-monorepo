import { AppError, ERROR_CODES } from '../../errors';

import { defaultProcessRunner } from './process-utils';

import type {
  IProcessRunner,
  ISecureStorage,
  SecureStorageBackend,
} from './types';

const SERVICE_NAME = 'onekey-cli';

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

  async get(key: string): Promise<Buffer | null> {
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
      await this.runner.execFileAsync('security', [
        'delete-generic-password',
        '-s',
        SERVICE_NAME,
        '-a',
        key,
      ]);
    } catch (error) {
      if (this.isItemNotFound(error)) {
        return;
      }
      throw this.mapError(error);
    }
  }

  private isItemNotFound(error: unknown): boolean {
    const err = error as Error & { code?: number; stderr?: string };
    return (
      err.code === 44 || err.stderr?.includes('could not be found') === true
    );
  }

  private mapError(error: unknown): AppError {
    const err = error as Error & { code?: number; stderr?: string };
    const stderr = err.stderr ?? err.message ?? '';

    if (err.code === 36 || stderr.includes('User interaction is not allowed')) {
      return new AppError(
        ERROR_CODES.SEC_KEYCHAIN_LOCKED.code,
        'Keychain is locked. Unlock your Mac and try again.',
        'Run: security unlock-keychain',
        { cause: error },
      );
    }

    if (stderr.includes('denied') || stderr.includes('not allowed')) {
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
