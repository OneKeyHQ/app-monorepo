import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAuthKeyPack } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { settingsPersistAtom } from '../../../states/jotai/atoms/settings';

import { buildKeylessLocalEncryptionKey } from './keylessLocalEncryptionKey';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

// In-memory cache for authPack, keyed by packSetId
// Module-level cache shared across all instances
// Note: Only stores the current user's authPack, cleared when caching new one
const authPackCache: Map<string, string> = new Map();

/**
 * Cache authPack in memory with encryption.
 * Uses sensitiveEncodeKey + session passcode as encryption key.
 * Avoids any disk persistence to reduce security risk.
 */
async function cacheAuthPackInMemory(params: {
  authPack: IAuthKeyPack;
  backgroundApi: IBackgroundApi;
}): Promise<{ success: boolean }> {
  const { authPack, backgroundApi } = params;
  const packSetId = authPack.packSetId;

  if (!packSetId) {
    throw new OneKeyLocalError('Pack set ID is required');
  }

  // 1. Serialize authPack to JSON string
  const authPackString = stringUtils.stableStringify(authPack);

  // 2. Build encryption key from sensitiveEncodeKey and session passcode
  const encryptionKey = await buildKeylessLocalEncryptionKey({ backgroundApi });

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

  return { success: true };
}

/**
 * Get authPack from memory cache and decrypt it.
 * Returns null if cache miss.
 */
async function getAuthPackFromCache(params: {
  packSetId: string;
  backgroundApi: IBackgroundApi;
}): Promise<IAuthKeyPack> {
  const { packSetId, backgroundApi } = params;

  // 1. Check if cache exists
  const encryptedAuthPack = authPackCache.get(packSetId);
  if (!encryptedAuthPack) {
    throw new OneKeyLocalError('Auth pack not found in cache');
  }

  // 2. Build decryption key from sensitiveEncodeKey and session passcode
  const decryptionKey = await buildKeylessLocalEncryptionKey({ backgroundApi });

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
    throw new OneKeyLocalError(
      'Failed to decrypt authPack from cache: invalid password or corrupted data',
    );
  }

  // 4. Parse JSON string to authPack object
  try {
    return JSON.parse(authPackString) as IAuthKeyPack;
  } catch (error) {
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
