import { OneKeyLocalError } from '../errors/errors/localError';
import platformEnv from '../platformEnv';

// These values are part of the recoverable key derivation contract. Changing
// any byte requires an explicit version and migration, not a copy update.
export const HARDWARE_CLOUD_SYNC_DERIVATION_VERSION = 1;
// BIP44 Legacy shape, so the device accepts it under default safety checks
// (OneKey Pro 2 firmware 1.0.3; other models are checked during hardware
// acceptance). Its account and address indexes are far beyond the accounts the
// App creates, so the key does not land on a user's account.
export const HARDWARE_CLOUD_SYNC_PATH = "m/44'/0'/924823361'/1/835069775";
export const HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX =
  'WARNING: Unlock ALL OneKey Cloud data. Sign ONLY in OneKey App, never in other apps or dApps.\nOneKey Cloud Key v1\nStandard wallet: ';

// Followed by the SHA-256 hex of the canonical standard wallet XFP.
export const HARDWARE_CLOUD_SYNC_CREDENTIAL_ID_PREFIX = 'hardware-cloud-v1-';

// The 16 characters the device shows in the message as "Standard wallet".
export function getHardwareCloudSyncIdentityTagFromCredentialId(
  credentialId: string,
): string {
  return credentialId.slice(
    HARDWARE_CLOUD_SYNC_CREDENTIAL_ID_PREFIX.length,
    HARDWARE_CLOUD_SYNC_CREDENTIAL_ID_PREFIX.length + 16,
  );
}

// Desktop and web use the patched hd-core over WebUSB. The extension uses the
// hd-web-sdk bundle, whose own log redaction list gets btcSignMessage at build
// time (development/rspack/loaders). Other runtimes fail closed.
export function isHardwareCloudSyncPlatformSupported(): boolean {
  return !!(
    platformEnv.isDesktop ||
    platformEnv.isNative ||
    platformEnv.isWeb ||
    platformEnv.isExtension
  );
}

export function buildHardwareCloudSyncMessage(identityTag: string): string {
  if (!/^[0-9a-f]{16}$/.test(identityTag)) {
    throw new OneKeyLocalError('Invalid standard wallet identity');
  }
  return `${HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX}${identityTag}`;
}
