/**
 * Keyless Cloud Sync Constants
 */

/** HTTP Header name for Keyless signature */
export const KEYLESS_SYNC_SIGNATURE_HEADER = 'x-onekey-keyless-sync-signature';

/** Encryption context identifier */
export const KEYLESS_SYNC_ENCRYPTION_CONTEXT = 'onekey-keyless-cloud-sync-v1';

/** Signature message validity period (5 minutes) */
export const KEYLESS_SYNC_SIGN_MESSAGE_EXPIRY_MS = 5 * 60 * 1000;

/** Keyless pwdHash prefix */
export const KEYLESS_PWDHASH_PREFIX = 'keyless-';

/** Keyless pwdHash context for derivation */
export const KEYLESS_PWDHASH_CONTEXT = 'A236111E-EEA8-41CC-9DB8-737D6BCAF7C7';

// SHA256 key derivation salts (for deriving signing/encryption keys from seed)
export const KEYLESS_SYNC_SIGNING_SALT = 'F7A3E1B2-8C4D-4F6E-9A1B-3D5E7F8A2C4D';
export const KEYLESS_SYNC_ENCRYPTION_SALT =
  'B2C4D6E8-1A3B-5C7D-9E1F-4A6B8C0D2E4F';

// Credential storage encryption (fixed key for obfuscation)
export const KEYLESS_SYNC_CREDENTIAL_STORAGE_KEY =
  'D1E2F3A4-B5C6-7D8E-9F0A-1B2C3D4E5F6A';
export const KEYLESS_SYNC_CREDENTIAL_STORAGE_AAD =
  '8A9B0C1D-2E3F-4A5B-6C7D-8E9F0A1B2C3D';

// Sync data AES-GCM AAD prefix (combined with itemId:dataType for per-item binding)
export const KEYLESS_SYNC_DATA_GCM_AAD = '3E4F5A6B-7C8D-9E0F-1A2B-4C5D6E7F8A9B';
