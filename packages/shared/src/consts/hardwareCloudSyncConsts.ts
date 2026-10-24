import { OneKeyLocalError } from '../errors/errors/localError';

// These values are part of the recoverable key derivation contract. Changing
// any byte requires an explicit version and migration, not a copy update.
export const HARDWARE_CLOUD_SYNC_DERIVATION_VERSION = 1;
export const HARDWARE_CLOUD_SYNC_PATH = "m/44'/0'/100'/0/0";
export const HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX =
  'WARNING: Unlock ALL OneKey Cloud data. Never sign in dApps.\nOneKey Cloud Key v1\nStandard wallet: ';

export function buildHardwareCloudSyncMessage(identityTag: string): string {
  if (!/^[0-9a-f]{16}$/.test(identityTag)) {
    throw new OneKeyLocalError('Invalid standard wallet identity');
  }
  return `${HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX}${identityTag}`;
}
