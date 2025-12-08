import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAuthKeyPack } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { settingsPersistAtom } from '../../../states/jotai/atoms/settings';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

// In-memory cache for authPack, keyed by packSetId
// Module-level cache shared across all instances
// Note: Only stores the current user's authPack, cleared when caching new one
const authPackCache: Map<string, string> = new Map();

/**
 * Build encryption key from sensitiveEncodeKey and session passcode.
 */
async function buildEncryptionKey(params: {
  backgroundApi: IBackgroundApi;
}): Promise<string> {
  const { backgroundApi } = params;

  // 1. Get sensitiveEncodeKey from settings
  const settings = await settingsPersistAtom.get();
  const sensitiveEncodeKey = settings.sensitiveEncodeKey;

  // 2. Get current session passcode
  const { password } =
    await backgroundApi.servicePassword.promptPasswordVerify();

  // 3. Combine sensitiveEncodeKey and passcode to form encryption key
  return `${sensitiveEncodeKey}${password}`;
}

/**
 * Cache authPack in memory with encryption.
 * Uses sensitiveEncodeKey + session passcode as encryption key.
 * Avoids any disk persistence to reduce security risk.
 */
async function cacheAuthPackInMemory(params: {
  authPack: IAuthKeyPack;
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  const { authPack, backgroundApi } = params;
  const packSetId = authPack.packSetId;

  // 1. Serialize authPack to JSON string
  const authPackString = stringUtils.stableStringify(authPack);

  // 2. Build encryption key from sensitiveEncodeKey and session passcode
  const encryptionKey = await buildEncryptionKey({ backgroundApi });

  // 3. Encrypt authPack string
  const encryptedAuthPack = await backgroundApi.servicePassword.encryptString({
    password: encryptionKey,
    data: authPackString,
    dataEncoding: 'utf8',
    allowRawPassword: true,
  });

  // 4. Clear all existing cache before storing new one
  // Cache only stores the current user's authPack, so clear previous entries
  authPackCache.clear();

  // 5. Store encrypted result in memory cache, keyed by packSetId
  authPackCache.set(packSetId, encryptedAuthPack);
}

/**
 * Get authPack from memory cache and decrypt it.
 * Returns null if cache miss.
 */
async function getAuthPackFromCache(params: {
  packSetId: string;
  backgroundApi: IBackgroundApi;
}): Promise<IAuthKeyPack | null> {
  const { packSetId, backgroundApi } = params;

  // 1. Check if cache exists
  const encryptedAuthPack = authPackCache.get(packSetId);
  if (!encryptedAuthPack) {
    return null;
  }

  // 2. Build decryption key from sensitiveEncodeKey and session passcode
  const decryptionKey = await buildEncryptionKey({ backgroundApi });

  // 3. Decrypt authPack string
  let authPackString: string;
  try {
    authPackString = await backgroundApi.servicePassword.decryptString({
      password: decryptionKey,
      data: encryptedAuthPack,
      dataEncoding: 'hex',
      resultEncoding: 'utf8',
      allowRawPassword: true,
    });
  } catch (error) {
    // If decryption fails (e.g., passcode changed), clear cache for this packSetId
    authPackCache.delete(packSetId);
    throw new OneKeyLocalError(
      'Failed to decrypt authPack from cache: invalid password or corrupted data',
    );
  }

  // 4. Parse JSON string to authPack object
  try {
    return JSON.parse(authPackString) as IAuthKeyPack;
  } catch (error) {
    // If parsing fails, clear corrupted cache for this packSetId
    authPackCache.delete(packSetId);
    throw new OneKeyLocalError(
      'Failed to parse authPack from cache: invalid JSON format',
    );
  }
}

/**
 * Clear authPack cache for a specific packSetId or all caches.
 * Should be called when user logs out or switches accounts.
 */
async function clearAuthPackCache(params?: {
  packSetId?: string;
}): Promise<void> {
  if (params?.packSetId) {
    // Clear cache for specific packSetId
    authPackCache.delete(params.packSetId);
  } else {
    // Clear all caches
    authPackCache.clear();
  }
}

export default {
  cacheAuthPackInMemory,
  getAuthPackFromCache,
  clearAuthPackCache,
};
