export type ISecureStorageSetOptions = {
  allowDiscoverable?: boolean;
  allowNewRegistration?: boolean;
};

// Structural error identity (matched by `name`: string literal, so
// minification-safe) for a secure-storage read that failed PERMANENTLY: the
// ciphertext exists but can never be decrypted again on this installation
// (e.g. the OS safeStorage key was rotated). Adapters attach it only where
// they positively know the failure is permanent; consumers must treat every
// unlabeled failure as transient — collapsing an unknown failure into
// "absent" is how still-recoverable data gets destroyed.
//
// Transport note: the desktop DESKTOP_API_CALL IPC boundary preserves only
// the error MESSAGE (makeIpcSafeError in apps/desktop/app/app.ts →
// unwrapElectronIpcError, which rebuilds the error under its own name), so
// the desktop main process encodes this sentinel INTO the message and the
// renderer-side adapter (secureStorage/index.desktop.ts) re-tags `name`
// from it before rethrowing. A bare `name` tag does NOT survive that hop.
export const SECURE_STORAGE_PERMANENT_READ_ERROR_NAME =
  'SecureStoragePermanentReadError';

// The bracketed prefix is the label's TRANSPORT form — the single source of
// the sentinel format shared by the producer (desktop main), the
// renderer-side matcher, and the tests. Matchers must anchor on this
// bracketed prefix, never on the bare name: a message that merely mentions
// the constant (a wrapping error, a nested cause, diagnostics) must not be
// mistaken for the label, because a false permanent verdict maps a
// recoverable value to "absent".
export const SECURE_STORAGE_PERMANENT_READ_ERROR_PREFIX = `[${SECURE_STORAGE_PERMANENT_READ_ERROR_NAME}]`;

// The only two message shapes the transport produces: the bracketed prefix
// at position 0 (an `Error:`-stripped or JSON-restored tail), or behind a
// single `<Name>: ` rendering of the main-side error name. Anchoring here —
// instead of a bare `includes` — keeps wrapper messages that merely EMBED
// the prefix deeper inside (e.g. "X read failed: [ ... ]") from being
// mistaken for the label itself. The NAME is interpolated unescaped, so it
// must remain word characters only ([A-Za-z0-9_]) — a rename introducing
// regex metacharacters would silently change this pattern's meaning.
export const SECURE_STORAGE_PERMANENT_READ_ERROR_MESSAGE_REGEX = new RegExp(
  `^(?:\\w+: )?\\[${SECURE_STORAGE_PERMANENT_READ_ERROR_NAME}\\]`,
);

export function buildSecureStoragePermanentReadErrorMessage(
  detail: string,
): string {
  return `${SECURE_STORAGE_PERMANENT_READ_ERROR_PREFIX} ${detail}`;
}

export interface ISecureStorage {
  setSecureItemWithBiometrics(
    key: string,
    data: string,
    options?: {
      authenticationPrompt?: string;
    },
  ): Promise<void>;
  setSecureItem(
    key: string,
    data: string,
    options?: ISecureStorageSetOptions,
  ): Promise<void>;
  getSecureItem(key: string): Promise<string | null>;
  removeSecureItem(key: string): Promise<void>;
  supportSecureStorage(): Promise<boolean>;
  supportSecureStorageWithoutInteraction(): Promise<boolean>;
  hasSecureItem?(key: string): Promise<boolean>;
  getCredentialId?(): Promise<string | null>;
  resetForPasskeyReEnroll?(): Promise<void>;
  // Snapshot the PRF re-enroll state (credential id / salt / wrapped master
  // key / transports + encrypted secure items) BEFORE a destructive reset so a
  // failed re-enroll can roll back instead of wiping a still-recoverable
  // biometric-unlock state. Ext-only (PRF); other platforms leave it undefined.
  snapshotForPasskeyReEnroll?(): Promise<Array<readonly [string, string]>>;
  restoreForPasskeyReEnroll?(
    snapshot: Array<readonly [string, string]>,
  ): Promise<void>;
}
