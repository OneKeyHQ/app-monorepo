/**
 * Public signer API for the CLI.
 *
 * Commands only ever need the one factory below; everything else is
 * re-exported for tests and internal wiring. Concrete signer classes
 * live under `./impls/<chain>/` and are only constructed by the
 * registry.
 */

export type { ISigner } from './types';
export { getSignerByImpl } from './factory';
export { SignerSoftwareBase } from './base/SignerSoftwareBase';
export { SignerHardwareBase } from './base/SignerHardwareBase';
export type {
  ISignerHardwareConfig,
  ISignerHardwareDeps,
} from './base/SignerHardwareBase';
export {
  CLI_PASSWORD,
  KEYCHAIN_PASSPHRASE_STATE_KEY,
  KEYCHAIN_SESSION_ID_KEY,
} from './keychain-keys';
