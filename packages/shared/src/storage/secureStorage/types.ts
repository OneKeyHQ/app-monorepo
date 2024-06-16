export interface ISecureStorage {
  setSecureItem(key: string, data: string): Promise<void>;
  getSecureItem(key: string): Promise<string | null>;
  removeSecureItem(key: string): Promise<void>;
  supportSecureStorage(): boolean;
}
