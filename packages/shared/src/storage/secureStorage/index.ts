/* eslint-disable @typescript-eslint/no-unused-vars, spellcheck/spell-checker */
import { OneKeyLocalError } from '../../errors';
import { webStorage } from '../instance/webStorageInstance';

import {
  PRF_CREDENTIAL_ID_KEY,
  PRF_SALT_KEY,
  TRANSPORT_DESCRIPTIONS,
  WRAPPED_MASTER_KEY_KEY,
  authenticateWithPrf,
  authenticateWithPrfDiscoverable,
  decryptWithMasterKey,
  encryptWithMasterKey,
  generateMasterKey,
  getTransportDescription,
  isPrfSupported,
  registerPrfCredential,
  unwrapMasterKey,
  wrapMasterKey,
} from './webauthnPrf';

import type { ISecureStorage } from './types';
import type { IAuthenticatorTransport } from './webauthnPrf';

// Prefix for secure storage keys to distinguish from other storage
const SECURE_STORAGE_KEY_PREFIX = '$secure$:';
// Storage key for credential transports (for user hints)
const PRF_CREDENTIAL_TRANSPORTS_KEY = '$secure_prf_credential_transports$';

// Master key cache (in-memory only, cleared on page reload)
let cachedMasterKey: Uint8Array | null = null;
let masterKeyCacheTimestamp = 0;
// Cache duration: 5 minutes (can be adjusted based on security requirements)
const MASTER_KEY_CACHE_DURATION_MS = 5 * 60 * 1000;

// Clear the master key cache
function clearMasterKeyCache(): void {
  cachedMasterKey = null;
  masterKeyCacheTimestamp = 0;
}

// Check if cached master key is still valid
function isMasterKeyCacheValid(): boolean {
  if (!cachedMasterKey) {
    return false;
  }
  const now = Date.now();
  return now - masterKeyCacheTimestamp < MASTER_KEY_CACHE_DURATION_MS;
}

// Get stored salt
async function getStoredSalt(): Promise<string | null> {
  return webStorage.getItem(PRF_SALT_KEY, undefined);
}

// Store salt
async function storeSalt(salt: string): Promise<void> {
  await webStorage.setItem(PRF_SALT_KEY, salt, undefined);
}

// Get stored wrapped master key
async function getStoredWrappedMasterKey(): Promise<string | null> {
  return webStorage.getItem(WRAPPED_MASTER_KEY_KEY, undefined);
}

// Store wrapped master key
async function storeWrappedMasterKey(wrappedKey: string): Promise<void> {
  await webStorage.setItem(WRAPPED_MASTER_KEY_KEY, wrappedKey, undefined);
}

// Get the full key with prefix
function getSecureKey(key: string): string {
  return `${SECURE_STORAGE_KEY_PREFIX}${key}`;
}

// Check if there's any encrypted data stored
async function hasEncryptedData(): Promise<boolean> {
  const allKeys = await webStorage.getAllKeys(undefined);
  return allKeys.some((key) => key.startsWith(SECURE_STORAGE_KEY_PREFIX));
}

// Authenticate and get PRF key
// Returns { prfKey, isNewCredential } to indicate if a new credential was created
async function getPrfKey(options?: {
  allowDiscoverable?: boolean;
  allowNewRegistration?: boolean;
}): Promise<{ prfKey: Uint8Array; isNewCredential: boolean } | null> {
  const { allowDiscoverable = true, allowNewRegistration = true } =
    options || {};

  const credentialId = await webStorage.getItem(
    PRF_CREDENTIAL_ID_KEY,
    undefined,
  );
  const storedSalt = await getStoredSalt();
  const wrappedMasterKey = await getStoredWrappedMasterKey();

  // Try with stored credential and salt first
  if (credentialId && storedSalt) {
    const result = await authenticateWithPrf({
      credentialId,
      salt: storedSalt,
    });
    if (result) {
      return { prfKey: result.prfKey, isNewCredential: false };
    }

    // If we have wrapped master key but authentication failed,
    // we should NOT allow switching to a different passkey
    if (wrappedMasterKey) {
      console.warn(
        'Authentication failed for stored credential. ' +
          'Cannot switch passkey because master key exists.',
      );
      return null;
    }
  }

  // If no stored credential, try discoverable mode to find existing passkeys
  if (allowDiscoverable && !credentialId) {
    const discoverableResult = await authenticateWithPrfDiscoverable();
    if (discoverableResult) {
      // Store the selected credential ID and the newly generated salt
      await webStorage.setItem(
        PRF_CREDENTIAL_ID_KEY,
        discoverableResult.credentialId,
        undefined,
      );
      await storeSalt(discoverableResult.salt);
      return { prfKey: discoverableResult.prfKey, isNewCredential: true };
    }
  }

  // If still no result and no wrapped master key, try to register a new credential
  if (allowNewRegistration && !wrappedMasterKey) {
    const credential = await registerPrfCredential();
    if (!credential) {
      return null;
    }

    // Store the new credential ID and salt
    await webStorage.setItem(
      PRF_CREDENTIAL_ID_KEY,
      credential.credentialId,
      undefined,
    );
    await storeSalt(credential.salt);

    // Store transports for user hints
    if (credential.transports) {
      await webStorage.setItem(
        PRF_CREDENTIAL_TRANSPORTS_KEY,
        JSON.stringify(credential.transports),
        undefined,
      );
    }

    return { prfKey: credential.prfKey, isNewCredential: true };
  }

  return null;
}

/**
 * Get the master key (unwrap from storage or create new)
 * Master key is cached in memory for better UX
 */
async function getMasterKey(): Promise<Uint8Array | null> {
  // Return cached master key if valid
  if (isMasterKeyCacheValid() && cachedMasterKey) {
    return cachedMasterKey;
  }

  // Get PRF key first
  const prfResult = await getPrfKey();
  if (!prfResult) {
    return null;
  }

  const { prfKey, isNewCredential } = prfResult;

  // Check if we have a wrapped master key
  const wrappedMasterKey = await getStoredWrappedMasterKey();

  if (wrappedMasterKey && !isNewCredential) {
    // Unwrap existing master key
    try {
      const masterKey = await unwrapMasterKey(prfKey, wrappedMasterKey);
      // Cache the master key
      cachedMasterKey = masterKey;
      masterKeyCacheTimestamp = Date.now();
      return masterKey;
    } catch (error) {
      console.error('Failed to unwrap master key:', error);
      throw new OneKeyLocalError('Failed to unlock secure storage');
    }
  }

  // Create new master key (first time setup or new credential)
  const masterKey = generateMasterKey();

  // Wrap and store the master key
  const wrapped = await wrapMasterKey(prfKey, masterKey);
  await storeWrappedMasterKey(wrapped);

  // Cache the master key
  cachedMasterKey = masterKey;
  masterKeyCacheTimestamp = Date.now();

  return masterKey;
}

const storage: ISecureStorage = {
  async setSecureItem(key: string, data: string): Promise<void> {
    const supported = await isPrfSupported();
    if (!supported) {
      throw new OneKeyLocalError(
        'Secure storage not supported: WebAuthn PRF not available',
      );
    }

    const masterKey = await getMasterKey();
    if (!masterKey) {
      throw new OneKeyLocalError(
        'Failed to authenticate with WebAuthn for secure storage',
      );
    }

    const encryptedData = await encryptWithMasterKey(masterKey, data);
    await webStorage.setItem(getSecureKey(key), encryptedData, undefined);
  },

  async getSecureItem(key: string): Promise<string | null> {
    const encryptedData = await webStorage.getItem(
      getSecureKey(key),
      undefined,
    );
    if (!encryptedData) {
      return null;
    }

    const supported = await isPrfSupported();
    if (!supported) {
      throw new OneKeyLocalError(
        'Secure storage not supported: WebAuthn PRF not available',
      );
    }

    const masterKey = await getMasterKey();
    if (!masterKey) {
      throw new OneKeyLocalError(
        'Failed to authenticate with WebAuthn for secure storage',
      );
    }

    try {
      return await decryptWithMasterKey(masterKey, encryptedData);
    } catch (error) {
      console.error('Failed to decrypt secure item:', error);
      throw new OneKeyLocalError('Failed to decrypt secure storage data');
    }
  },

  async removeSecureItem(key: string): Promise<void> {
    await webStorage.removeItem(getSecureKey(key), undefined);
  },

  async supportSecureStorage(): Promise<boolean> {
    // Synchronous check - basic browser support
    // For full PRF support check, use isPrfSupported() async function
    // return isPrfSupported();

    // TODO: remove this after test
    // Note: On extension and web platforms, creating a mnemonic wallet will always require biometric verification by design,
    // regardless of whether the user chooses to enable biometrics. This is because the password UI component does not synchronize this state.
    return false;
  },

  async setSecureItemWithBiometrics(
    key: string,
    data: string,
    options?: { authenticationPrompt?: string },
  ): Promise<void> {
    // WebAuthn PRF already requires biometric/PIN verification
    // The authenticationPrompt is handled by the browser's WebAuthn UI
    return this.setSecureItem(key, data);
  },
};

// native: expo-secure-store
// desktop: electron safe-storage
// web: WebAuthn PRF extension for key derivation

/**
 * Get the stored credential's transport types (for user hints)
 * Returns human-readable description of the authenticator used
 */
async function getStoredCredentialTransports(): Promise<
  IAuthenticatorTransport[] | null
> {
  const transportsJson = await webStorage.getItem(
    PRF_CREDENTIAL_TRANSPORTS_KEY,
    undefined,
  );
  if (!transportsJson) {
    return null;
  }
  try {
    return JSON.parse(transportsJson) as IAuthenticatorTransport[];
  } catch {
    return null;
  }
}

/**
 * Get human-readable description of the stored authenticator
 * Useful for showing hints like "Please use your USB Security Key"
 */
async function getStoredAuthenticatorDescription(): Promise<string> {
  const transports = await getStoredCredentialTransports();
  return getTransportDescription(transports ?? undefined);
}

export {
  getStoredCredentialTransports,
  getStoredAuthenticatorDescription,
  clearMasterKeyCache,
  TRANSPORT_DESCRIPTIONS,
  getTransportDescription,
};
export default storage;
