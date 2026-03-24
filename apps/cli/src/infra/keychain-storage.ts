import { execFile, spawn } from 'node:child_process';

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

function spawnWithStdin(
  cmd: string,
  args: string[],
  input: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        const err = new Error(`Process exited with code ${code}`) as Error & {
          code: number;
          stderr: string;
        };
        err.code = code ?? 1;
        err.stderr = stderr;
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
    // Append newline so `read -r secret` in the shell script exits 0
    // (POSIX read exits non-zero on EOF without a trailing newline)
    child.stdin.write(`${input}\n`);
    child.stdin.end();
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
      // Pass secret via stdin to avoid exposure in process argv (visible via `ps`)
      await spawnWithStdin(
        'sh',
        [
          '-c',
          'read -r secret && security add-generic-password -s "$1" -a "$2" -w "$secret" -U',
          '--',
          SERVICE_NAME,
          key,
        ],
        hex,
      );
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
