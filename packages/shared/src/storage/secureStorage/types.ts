export type ISecureStorageSetOptions = {
  allowDiscoverable?: boolean;
  allowNewRegistration?: boolean;
};

// Structural error identity (matched by `name`: string literal, so
// minification-safe, and preserved across the desktop IPC bridge — see
// JsBridgeBase.toPlainError) for a secure-storage read that failed
// PERMANENTLY: the ciphertext exists but can never be decrypted again on
// this installation (e.g. the OS safeStorage key was rotated). Adapters
// attach it only where they positively know the failure is permanent;
// consumers must treat every unlabeled failure as transient — collapsing an
// unknown failure into "absent" is how still-recoverable data gets
// destroyed.
export const SECURE_STORAGE_PERMANENT_READ_ERROR_NAME =
  'SecureStoragePermanentReadError';

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
