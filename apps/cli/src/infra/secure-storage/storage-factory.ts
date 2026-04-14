import { AppError, ERROR_CODES } from '../../errors';

import { LinuxSecureStorage } from './secure-storage.linux';
import { MacOSSecureStorage } from './secure-storage.macos';

import type { ISecureStorage } from './types';

export function createSecureStorage(
  platform: NodeJS.Platform = process.platform,
): ISecureStorage {
  if (platform === 'darwin') {
    return new MacOSSecureStorage();
  }

  if (platform === 'linux') {
    return new LinuxSecureStorage();
  }

  throw new AppError(
    ERROR_CODES.SEC_STORAGE_BACKEND_UNAVAILABLE.code,
    `Secure storage is not supported on platform "${platform}".`,
    'Use macOS Keychain or Linux Secret Service to store wallet secrets.',
    { details: { platform } },
  );
}
