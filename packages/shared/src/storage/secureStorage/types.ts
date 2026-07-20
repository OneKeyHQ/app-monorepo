export type ISecureStorageSetOptions = {
  allowDiscoverable?: boolean;
  allowNewRegistration?: boolean;
};

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
