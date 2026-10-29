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

// Signs server sign-in challenges. It must differ from HARDWARE_CLOUD_SYNC_PATH:
// a server-chosen message on the key path could return the data key itself.
export const HARDWARE_CLOUD_SYNC_AUTH_PATH = "m/44'/0'/924823361'/1/835069776";
export const HARDWARE_CLOUD_SYNC_AUTH_MESSAGE_PREFIX =
  'OneKey Cloud Sync sign-in\n';
// Server-side records holding a wrapped data key; never synced into local data.
export const HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE = 'HardwareKeyEnvelope';
// pwdHash of hardware data: this prefix + sha256(dekId), so any key version is
// identified without unwrapping it.
export const HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX = 'hw-dek-';
// The KEK line appended to the key message: a 16-byte random salt per data
// key, so a signature taken before a reset no longer opens the new envelope.
export const HARDWARE_CLOUD_SYNC_KEK_SALT_LINE = '\nKey: ';
export const HARDWARE_CLOUD_SYNC_KEK_VERSION = 1;
export const HARDWARE_CLOUD_SYNC_KEK_HKDF_INFO = 'onekey-hw-cloudsync-kek-v1';

export function isHardwareCloudSyncKekSalt(
  kekSalt: unknown,
): kekSalt is string {
  return typeof kekSalt === 'string' && /^[0-9a-f]{32}$/.test(kekSalt);
}

// The exact sign-in template: the server fills in only the nonce, the DPoP key
// tag and the expiry, so it cannot put its own text on the device screen.
const HARDWARE_CLOUD_SYNC_AUTH_MESSAGE_PATTERN =
  /^OneKey Cloud Sync sign-in\nOnly confirm this inside the OneKey App\.\nNonce: [0-9a-f]{64}\nDevice: [A-Za-z0-9_-]{8}\nExpires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function assertHardwareCloudSyncAuthMessage(message: string): void {
  if (
    typeof message !== 'string' ||
    message.length > 512 ||
    !message.startsWith(HARDWARE_CLOUD_SYNC_AUTH_MESSAGE_PREFIX) ||
    message.includes(HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX) ||
    !HARDWARE_CLOUD_SYNC_AUTH_MESSAGE_PATTERN.test(message)
  ) {
    throw new OneKeyLocalError('Invalid Cloud sync sign-in challenge');
  }
}

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

// 185 bytes: warning, version and wallet lines, then the envelope's salt. The
// salt is checked so the server cannot make the device show arbitrary text.
export function buildHardwareCloudSyncMessage(
  identityTag: string,
  kekSalt: string,
): string {
  if (!/^[0-9a-f]{16}$/.test(identityTag)) {
    throw new OneKeyLocalError('Invalid standard wallet identity');
  }
  if (!isHardwareCloudSyncKekSalt(kekSalt)) {
    throw new OneKeyLocalError('Invalid Cloud sync key salt');
  }
  return `${HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX}${identityTag}${HARDWARE_CLOUD_SYNC_KEK_SALT_LINE}${kekSalt}`;
}
