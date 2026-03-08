/**
 * Keyless Cloud Sync Constants
 *
 * Keyless-specific derivation paths
 */

/** Keyless sync derivation path prefix */
export const KEYLESS_SYNC_DERIVATION_PATH_PREFIX = "m/44'/38716591'/98351420'";

/** Keyless signing key derivation path */
export const KEYLESS_SYNC_DERIVATION_PATH_SIGNING =
  "m/44'/38716591'/98351420'/0/0";

/** Keyless encryption key derivation path */
export const KEYLESS_SYNC_DERIVATION_PATH_ENCRYPTION =
  "m/44'/38716591'/98351420'/0/1";

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
