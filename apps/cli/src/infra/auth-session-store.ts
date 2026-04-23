import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { AppError, ERROR_CODES } from '../errors';

import type {
  AuthLoginMethod,
  AuthSessionMetadata,
  AuthWalletKind,
} from '../core/auth/auth-types';

const DEFAULT_AUTH_SESSION_PATH = join(
  homedir(),
  '.onekey',
  'auth-session.json',
);
const AUTH_SESSION_DIR_MODE = 0o700;
const AUTH_SESSION_FILE_MODE = 0o600;

export const AUTH_SESSION_SCHEMA_VERSION = 1;

interface IRawAuthSessionMetadata {
  schema_version: number;
  login_method: AuthLoginMethod;
  wallet_kind: AuthWalletKind;
  display_address: string;
  imported_at: string;
  source_label: string;
}

function isErrnoCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === code
  );
}

function isValidSessionMetadata(value: unknown): value is AuthSessionMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const metadata = value as Record<string, unknown>;

  return (
    metadata.schemaVersion === AUTH_SESSION_SCHEMA_VERSION &&
    metadata.loginMethod === 'app_transfer' &&
    metadata.walletKind === 'hd' &&
    typeof metadata.displayAddress === 'string' &&
    metadata.displayAddress.length > 0 &&
    typeof metadata.importedAt === 'string' &&
    !Number.isNaN(Date.parse(metadata.importedAt)) &&
    typeof metadata.sourceLabel === 'string' &&
    metadata.sourceLabel.length > 0
  );
}

function toRawSession(metadata: AuthSessionMetadata): IRawAuthSessionMetadata {
  return {
    schema_version: metadata.schemaVersion,
    login_method: metadata.loginMethod,
    wallet_kind: metadata.walletKind,
    display_address: metadata.displayAddress,
    imported_at: metadata.importedAt,
    source_label: metadata.sourceLabel,
  };
}

function fromRawSession(value: unknown): AuthSessionMetadata {
  if (typeof value !== 'object' || value === null) {
    throw new AppError(
      ERROR_CODES.AUTH_SESSION_INVALID.code,
      'Auth session metadata is corrupted.',
      'Run: onekey auth logout and login again.',
    );
  }

  const raw = value as Partial<IRawAuthSessionMetadata>;
  const metadata: AuthSessionMetadata = {
    schemaVersion: raw.schema_version as number,
    loginMethod: raw.login_method as AuthLoginMethod,
    walletKind: raw.wallet_kind as AuthWalletKind,
    displayAddress: raw.display_address as string,
    importedAt: raw.imported_at as string,
    sourceLabel: raw.source_label as string,
  };

  if (!isValidSessionMetadata(metadata)) {
    throw new AppError(
      ERROR_CODES.AUTH_SESSION_INVALID.code,
      'Auth session metadata is corrupted.',
      'Run: onekey auth logout and login again.',
    );
  }

  return metadata;
}

function tmpPath(path: string): string {
  return `${path}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`;
}

export class AuthSessionStore {
  private readonly sessionPath: string;

  constructor(sessionPath: string = DEFAULT_AUTH_SESSION_PATH) {
    this.sessionPath = sessionPath;
  }

  getSessionPath(): string {
    return this.sessionPath;
  }

  async load(): Promise<AuthSessionMetadata | null> {
    let raw: string;

    try {
      raw = await fs.readFile(this.sessionPath, 'utf-8');
    } catch (error) {
      if (isErrnoCode(error, 'ENOENT')) {
        return null;
      }

      throw new AppError(
        ERROR_CODES.AUTH_SESSION_INVALID.code,
        'Failed to read auth session metadata.',
        'Check ~/.onekey/auth-session.json and try again.',
        { cause: error },
      );
    }

    try {
      return fromRawSession(JSON.parse(raw) as unknown);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        ERROR_CODES.AUTH_SESSION_INVALID.code,
        'Auth session metadata is corrupted.',
        'Run: onekey auth logout and login again.',
        { cause: error },
      );
    }
  }

  async save(metadata: AuthSessionMetadata): Promise<void> {
    if (!isValidSessionMetadata(metadata)) {
      throw new AppError(
        ERROR_CODES.AUTH_SESSION_PERSIST_FAILED.code,
        'Auth session metadata is invalid.',
        'Check the auth session payload before persisting it.',
      );
    }

    const path = this.sessionPath;
    const sessionDir = dirname(path);
    const tempPath = tmpPath(path);
    const payload = `${JSON.stringify(toRawSession(metadata), null, 2)}\n`;

    try {
      await fs.mkdir(sessionDir, {
        recursive: true,
        mode: AUTH_SESSION_DIR_MODE,
      });
      await fs.chmod(sessionDir, AUTH_SESSION_DIR_MODE);
      await fs.writeFile(tempPath, payload, {
        encoding: 'utf-8',
        mode: AUTH_SESSION_FILE_MODE,
      });
      await fs.rename(tempPath, path);
      await fs.chmod(path, AUTH_SESSION_FILE_MODE);
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
      throw new AppError(
        ERROR_CODES.AUTH_SESSION_PERSIST_FAILED.code,
        'Failed to persist auth session metadata.',
        'Check file permissions for ~/.onekey/auth-session.json and retry.',
        { cause: error },
      );
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.rm(this.sessionPath, { force: true });
    } catch (error) {
      if (isErrnoCode(error, 'ENOENT')) {
        return;
      }

      throw new AppError(
        ERROR_CODES.AUTH_SESSION_PERSIST_FAILED.code,
        'Failed to clear auth session metadata.',
        'Check file permissions for ~/.onekey/auth-session.json and retry.',
        { cause: error },
      );
    }
  }
}
