/**
 * OS-keychain entry keys for the CLI's persisted secrets.
 *
 * The `wallet:<name>/*` layout matches the `security add-generic-password`
 * naming convention on macOS and libsecret attributes on Linux. All four
 * keys share the same `default` wallet namespace so a single logout run
 * can enumerate + purge them together.
 */

const WALLET_NAME = 'default';

/** CLI-internal password used to encrypt locally derived secrets. */
export const CLI_PASSWORD = 'onekey';

// HD (software) wallet — filled by the `auth login --app-transfer` flow.
export const KEYCHAIN_MNEMONIC_KEY = `wallet:${WALLET_NAME}/mnemonic`;
export const KEYCHAIN_ENCRYPTION_KEY = `wallet:${WALLET_NAME}/encryption-key`;

// Hardware hidden-wallet — filled by the `auth login --hardware` flow.
export const KEYCHAIN_PASSPHRASE_STATE_KEY = `wallet:${WALLET_NAME}/passphrase-state`;
export const KEYCHAIN_SESSION_ID_KEY = `wallet:${WALLET_NAME}/session-id`;
