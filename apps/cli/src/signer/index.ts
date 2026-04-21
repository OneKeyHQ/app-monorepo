/**
 * Public signer API for the CLI.
 *
 * Commands only ever need the two factories below. Concrete signer
 * classes live under `./impls/<chain>/` and are constructed by the
 * registry — no consumer should import them by class name.
 *
 * NOTE: `SignerBase` currently carries HD-specific helpers (mnemonic
 * decryption); in a follow-up it should be renamed to `SignerHdBase` to
 * match kit-bg's `KeyringHdBase` vs `KeyringHardwareBase` split. Left as
 * a mechanical rename because 15+ call sites import the keychain
 * constants from it.
 */

export type { ISigner } from './types';
export { getSignerByImpl } from './factory';
export { SignerBase } from './base/SignerBase';
export {
  KEYCHAIN_ENCRYPTION_KEY,
  KEYCHAIN_MNEMONIC_KEY,
  KEYCHAIN_PASSPHRASE_STATE_KEY,
  KEYCHAIN_SESSION_ID_KEY,
} from './base/SignerBase';
export { SignerHardwareBase } from './base/SignerHardwareBase';
export type {
  ISignerHardwareConfig,
  ISignerHardwareDeps,
} from './base/SignerHardwareBase';
