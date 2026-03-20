import { execFile } from 'node:child_process';

import { AppError, ERROR_CODES } from '../errors';

function execFileAsync(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout, stderr) => {
      if (error) {
        (error as Error & { stderr?: string }).stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

const SERVICE_NAME = 'onekey-cli';

export interface ISecureStorage {
  get(key: string): Promise<Buffer | null>;
  set(key: string, value: Buffer): Promise<void>;
  delete(key: string): Promise<void>;
}

export class KeychainStorage implements ISecureStorage {
  async set(key: string, value: Buffer): Promise<void> {
    const hex = value.toString('hex');
    try {
      await execFileAsync('security', [
        'add-generic-password',
        '-s',
        SERVICE_NAME,
        '-a',
        key,
        '-w',
        hex,
        '-U',
      ]);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const { stdout } = await execFileAsync('security', [
        'find-generic-password',
        '-s',
        SERVICE_NAME,
        '-a',
        key,
        '-w',
      ]);
      const hex = stdout.trim();
      if (hex.length === 0) {
        return null;
      }
      return Buffer.from(hex, 'hex');
    } catch (error) {
      if (this.isItemNotFound(error)) {
        return null;
      }
      throw this.mapError(error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await execFileAsync('security', [
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
    if (err.code === 44) return true;
    if (err.stderr?.includes('could not be found')) return true;
    return false;
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
        'Keychain access was denied',
        'Grant access in System Preferences > Security & Privacy',
        { cause: error },
      );
    }

    return new AppError(
      ERROR_CODES.SEC_KEYCHAIN_ERROR.code,
      'Keychain operation failed',
      'Check macOS Keychain Access',
      { cause: error },
    );
  }
}
