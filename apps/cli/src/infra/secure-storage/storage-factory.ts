/* oxlint-disable @cspell/spellchecker */

import { AppError, ERROR_CODES } from '../../errors';

import { LinuxSecureStorage } from './secure-storage.linux';
import { MacOSSecureStorage } from './secure-storage.macos';
import {
  NapiRsKeyringSecureStorage,
  isNapiRsKeyringSupportedCliRuntime,
} from './secure-storage.napi-rs-keyring';

import type { IKeyringModuleLoader } from './secure-storage.napi-rs-keyring';
import type { IProcessRunner, ISecureStorage } from './types';

/**
 * Global rollout switch for the native @napi-rs/keyring backend.
 *
 * Keep this `true` by default. Flip to `false` only for an emergency rollback
 * to the platform legacy implementations.
 */
export const SECURE_STORAGE_USE_NAPI_RS_KEYRING = true;

export type ICreateSecureStorageOptions = {
  arch?: NodeJS.Architecture;
  keyringModuleLoader?: IKeyringModuleLoader;
  runner?: IProcessRunner;
  useNapiRsKeyring?: boolean;
};

export function createSecureStorage(
  platform: NodeJS.Platform = process.platform,
  options: ICreateSecureStorageOptions = {},
): ISecureStorage {
  const useNapiRsKeyring =
    options.useNapiRsKeyring ?? SECURE_STORAGE_USE_NAPI_RS_KEYRING;
  const arch = options.arch ?? process.arch;

  if (useNapiRsKeyring && isNapiRsKeyringSupportedCliRuntime(platform, arch)) {
    return new NapiRsKeyringSecureStorage({
      keyringModuleLoader: options.keyringModuleLoader,
      platform,
    });
  }

  if (platform === 'darwin') {
    return new MacOSSecureStorage(options.runner);
  }

  if (platform === 'linux') {
    return new LinuxSecureStorage(options.runner);
  }

  throw new AppError(
    ERROR_CODES.SEC_STORAGE_BACKEND_UNAVAILABLE.code,
    `Secure storage is not supported on platform "${platform}".`,
    useNapiRsKeyring
      ? 'Use macOS Keychain, Linux Secret Service, or Windows Credential Manager to store wallet secrets.'
      : 'Legacy secure storage is only available for macOS Keychain and Linux Secret Service.',
    { details: { arch, platform, useNapiRsKeyring } },
  );
}
