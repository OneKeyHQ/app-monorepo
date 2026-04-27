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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Minimal keychain interface — matches both KeychainStorage and test stubs. */
interface IKeychainSessionStore {
  set(key: string, value: Buffer): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Write passphraseState and sessionId to the OS keychain as a pair.
 *
 * These two keys MUST stay in sync: a stale session-id paired with a fresh
 * passphrase-state makes the SDK reject every call, causing infinite
 * pinentry prompts. Routing all writes through this helper enforces the
 * invariant — callers never write one key without the other.
 *
 * If either write fails, both keys are cleared so the next command rebuilds a
 * fresh pair instead of reading a half-new or stale pair.
 */
export async function persistKeychainSessionPair(
  keychain: IKeychainSessionStore,
  passphraseState: string,
  sessionId: string,
): Promise<void> {
  try {
    await keychain.set(
      KEYCHAIN_PASSPHRASE_STATE_KEY,
      Buffer.from(passphraseState, 'utf-8'),
    );
    await keychain.set(
      KEYCHAIN_SESSION_ID_KEY,
      Buffer.from(sessionId, 'utf-8'),
    );
  } catch (error) {
    await Promise.allSettled([
      keychain.delete(KEYCHAIN_PASSPHRASE_STATE_KEY),
      keychain.delete(KEYCHAIN_SESSION_ID_KEY),
    ]);
    throw error;
  }
}
