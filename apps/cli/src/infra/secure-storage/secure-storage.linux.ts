import { AppError, ERROR_CODES } from '../../errors';

import { defaultProcessRunner } from './process-utils';

import type {
  IProcessRunner,
  ISecureStorage,
  SecureStorageBackend,
} from './types';

const SERVICE_NAME = 'onekey-cli';
const SECRET_LABEL = 'OneKey CLI Secret';

export class LinuxSecureStorage implements ISecureStorage {
  private readonly runner: IProcessRunner;

  constructor(runner: IProcessRunner = defaultProcessRunner) {
    this.runner = runner;
  }

  getBackendType(): SecureStorageBackend {
    return 'linux-secret-service';
  }

  async set(key: string, value: Buffer): Promise<void> {
    try {
      await this.runner.spawnWithStdin(
        'secret-tool',
        [
          'store',
          '--label',
          SECRET_LABEL,
          'service',
          SERVICE_NAME,
          'account',
          key,
        ],
        value.toString('hex'),
      );
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const { stdout } = await this.runner.execFileAsync('secret-tool', [
        'lookup',
        'service',
        SERVICE_NAME,
        'account',
        key,
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
      await this.runner.execFileAsync('secret-tool', [
        'clear',
        'service',
        SERVICE_NAME,
        'account',
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
    const err = error as Error & { stderr?: string };
    const stderr = err.stderr ?? err.message ?? '';

    return (
      stderr.includes('No such secret item') ||
      stderr.includes('Object does not exist') ||
      stderr.includes('could not find')
    );
  }

  private mapError(error: unknown): AppError {
    const err = error as Error & { code?: number | string; stderr?: string };
    const stderr = err.stderr ?? err.message ?? '';

    if (
      err.code === 'ENOENT' ||
      stderr.includes('secret-tool: not found') ||
      stderr.includes('command not found')
    ) {
      return new AppError(
        ERROR_CODES.SEC_STORAGE_BACKEND_UNAVAILABLE.code,
        'Linux secure storage backend is unavailable.',
        'Install libsecret/secret-tool and ensure a Secret Service provider is running.',
        { cause: error },
      );
    }

    if (
      stderr.includes('Cannot autolaunch D-Bus') ||
      stderr.includes('org.freedesktop.Secret.Service') ||
      stderr.includes('No secret service')
    ) {
      return new AppError(
        ERROR_CODES.SEC_STORAGE_BACKEND_UNAVAILABLE.code,
        'Linux Secret Service is not available.',
        'Start a Secret Service provider such as gnome-keyring or KWallet and retry.',
        { cause: error },
      );
    }

    if (
      stderr.toLowerCase().includes('permission denied') ||
      stderr.includes('denied')
    ) {
      return new AppError(
        ERROR_CODES.SEC_STORAGE_ACCESS_DENIED.code,
        'Linux secure storage access was denied.',
        'Grant Secret Service access to secret-tool and try again.',
        { cause: error },
      );
    }

    return new AppError(
      ERROR_CODES.SEC_STORAGE_ERROR.code,
      'Linux secure storage operation failed.',
      'Check secret-tool and your Secret Service session, then retry.',
      { cause: error },
    );
  }
}
