export interface ISecureStorage {
  setSecureItemWithBiometrics(
    key: string,
    data: string,
    options?: {
      authenticationPrompt?: string;
    },
  ): Promise<void>;
  setSecureItem(key: string, data: string): Promise<void>;
  getSecureItem(key: string): Promise<string | null>;
  removeSecureItem(key: string): Promise<void>;
  supportSecureStorage(): Promise<boolean>;
}
