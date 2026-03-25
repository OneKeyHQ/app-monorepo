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
}
