import { OneKeyLocalError } from '../errors/errors/localError';
import platformEnv from '../platformEnv';

// Final v1 contract for this unreleased feature. Pre-release paths and data
// are not retained; changes after release require a version and migration.
export const HARDWARE_CLOUD_SYNC_DERIVATION_VERSION = 1;
// Classic firmware permits at most 1,000,000 for the final address index.
export const HARDWARE_CLOUD_SYNC_PATH = "m/44'/0'/924823361'/1/369775";
export const HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX =
  'WARNING: Sign ONLY in OneKey App. NEVER in other apps or dApps. Signing unlocks ALL your OneKey Cloud data. >>> type=onekey-cloud-key;v=1;wallet=';

// Signs server sign-in challenges. It must differ from HARDWARE_CLOUD_SYNC_PATH:
// a server-chosen message on the key path could return the data key itself.
export const HARDWARE_CLOUD_SYNC_AUTH_PATH = "m/44'/0'/924823361'/1/369776";
export const HARDWARE_CLOUD_SYNC_AUTH_MESSAGE_PREFIX =
  'WARNING: Sign ONLY in OneKey App. NEVER in other apps or dApps. Signing approves OneKey Cloud sign-in. >>> ';
export const HARDWARE_CLOUD_SYNC_AUTH_SERVICE = 'onekey-cloud-sync';
// Server-side records holding a wrapped data key; never synced into local data.
export const HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE = 'HardwareKeyEnvelope';
// pwdHash of hardware data: this prefix + sha256(dekId), so any key version is
// identified without unwrapping it.
export const HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX = 'hw-dek-';
// The KEK field appended to the key message: a 16-byte random salt per data
// key, so a signature taken before a reset no longer opens the new envelope.
export const HARDWARE_CLOUD_SYNC_KEK_SALT_FIELD = ';salt=';
export const HARDWARE_CLOUD_SYNC_KEK_VERSION = 1;
export const HARDWARE_CLOUD_SYNC_KEK_HKDF_INFO = 'onekey-hw-cloudsync-kek-v1';

export function isHardwareCloudSyncKekSalt(
  kekSalt: unknown,
): kekSalt is string {
  return (
    typeof kekSalt === 'string' &&
    kekSalt.length === 32 &&
    /^[0-9a-f]{32}$/.test(kekSalt)
  );
}

export type IHardwareCloudSyncAuthContext = {
  identityTag: string;
  env: 'prod' | 'test';
  jkt: string;
};

export type IHardwareCloudSyncAuthMessage = IHardwareCloudSyncAuthContext & {
  nonce: string;
  session: string;
  expires: string;
};

// Exact, ordered v1 bytes. No unknown fields, alternate whitespace or legacy
// draft is accepted. These drafts have never been a released protocol.
const HARDWARE_CLOUD_SYNC_AUTH_MESSAGE_PATTERN =
  /^type=onekey-cloud-signin;v=1;service=onekey-cloud-sync;env=(prod|test);wallet=([0-9a-f]{16});nonce=([0-9a-f]{64});session=([A-Za-z0-9_-]{8});jkt=([A-Za-z0-9_-]{43});expires=(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/;

export function parseHardwareCloudSyncAuthMessage(
  message: string,
): IHardwareCloudSyncAuthMessage {
  if (
    typeof message !== 'string' ||
    message.length > 512 ||
    /[^\x20-\x7e]/.test(message) ||
    !message.startsWith(HARDWARE_CLOUD_SYNC_AUTH_MESSAGE_PREFIX) ||
    message.includes(HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX)
  ) {
    throw new OneKeyLocalError('Invalid Cloud sync sign-in challenge');
  }
  const match = HARDWARE_CLOUD_SYNC_AUTH_MESSAGE_PATTERN.exec(
    message.slice(HARDWARE_CLOUD_SYNC_AUTH_MESSAGE_PREFIX.length),
  );
  if (!match) {
    throw new OneKeyLocalError('Invalid Cloud sync sign-in challenge');
  }
  const [, env, identityTag, nonce, session, jkt, expires] = match;
  const expiresAt = Date.parse(expires);
  if (
    (env !== 'prod' && env !== 'test') ||
    !Number.isFinite(expiresAt) ||
    new Date(expiresAt).toISOString() !== expires ||
    session !== jkt.slice(0, 8)
  ) {
    throw new OneKeyLocalError('Invalid Cloud sync sign-in challenge');
  }
  return { env, identityTag, nonce, session, jkt, expires };
}

export function assertHardwareCloudSyncAuthMessage(message: string): void {
  parseHardwareCloudSyncAuthMessage(message);
}

export function assertHardwareCloudSyncAuthContext(
  message: string,
  expected: IHardwareCloudSyncAuthContext,
  now: number,
): IHardwareCloudSyncAuthMessage {
  const fields = parseHardwareCloudSyncAuthMessage(message);
  const expiresAt = Date.parse(fields.expires);
  if (
    fields.identityTag !== expected.identityTag ||
    fields.env !== expected.env ||
    fields.jkt !== expected.jkt ||
    !Number.isFinite(now) ||
    expiresAt <= now ||
    expiresAt > now + 15 * 60 * 1000
  ) {
    throw new OneKeyLocalError('Invalid Cloud sync sign-in challenge');
  }
  return fields;
}

export function buildHardwareCloudSyncAuthMessage({
  identityTag,
  env,
  nonce,
  jkt,
  expires,
}: IHardwareCloudSyncAuthContext & { nonce: string; expires: string }): string {
  const message = `${HARDWARE_CLOUD_SYNC_AUTH_MESSAGE_PREFIX}type=onekey-cloud-signin;v=1;service=${HARDWARE_CLOUD_SYNC_AUTH_SERVICE};env=${env};wallet=${identityTag};nonce=${nonce};session=${jkt.slice(0, 8)};jkt=${jkt};expires=${expires}`;
  assertHardwareCloudSyncAuthMessage(message);
  return message;
}

// Followed by the SHA-256 hex of the canonical standard wallet XFP.
export const HARDWARE_CLOUD_SYNC_CREDENTIAL_ID_PREFIX = 'hardware-cloud-v1-';

// The 16 characters the device shows in the message's wallet field.
export function getHardwareCloudSyncIdentityTagFromCredentialId(
  credentialId: string,
): string {
  if (
    credentialId.length !==
      HARDWARE_CLOUD_SYNC_CREDENTIAL_ID_PREFIX.length + 64 ||
    !/^hardware-cloud-v1-[0-9a-f]{64}$/.test(credentialId)
  ) {
    throw new OneKeyLocalError('Invalid standard wallet identity');
  }
  return credentialId.slice(
    HARDWARE_CLOUD_SYNC_CREDENTIAL_ID_PREFIX.length,
    HARDWARE_CLOUD_SYNC_CREDENTIAL_ID_PREFIX.length + 16,
  );
}

// Supported platforms use the default upstream SDK integration; iframe-based
// transports use official prebuilt assets. Release requires an upstream
// btcSignMessage redaction fix, an App SDK upgrade, and acceptance checks
// confirming the same fix in every shipped SDK/iframe.
export function isHardwareCloudSyncPlatformSupported(): boolean {
  return !!(
    platformEnv.isDesktop ||
    platformEnv.isNative ||
    platformEnv.isWeb ||
    platformEnv.isExtension
  );
}

// 199 ASCII bytes: frozen v1 warning, wallet field and envelope salt. The
// salt is checked so the server cannot make the device show arbitrary text.
export function buildHardwareCloudSyncMessage(
  identityTag: string,
  kekSalt: string,
): string {
  if (identityTag.length !== 16 || !/^[0-9a-f]{16}$/.test(identityTag)) {
    throw new OneKeyLocalError('Invalid standard wallet identity');
  }
  if (!isHardwareCloudSyncKekSalt(kekSalt)) {
    throw new OneKeyLocalError('Invalid Cloud sync key salt');
  }
  return `${HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX}${identityTag}${HARDWARE_CLOUD_SYNC_KEK_SALT_FIELD}${kekSalt}`;
}
