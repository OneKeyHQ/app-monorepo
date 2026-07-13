import { createSecureStorage } from './secure-storage/storage-factory';

import type {
  ISecureStorage,
  SecureStorageBackend,
} from './secure-storage/types';

export type {
  IProcessRunner,
  ISecureStorage,
  SecureStorageBackend,
} from './secure-storage/types';
export {
  SECURE_STORAGE_USE_NAPI_RS_KEYRING,
  createSecureStorage,
} from './secure-storage/storage-factory';
export { LinuxSecureStorage } from './secure-storage/secure-storage.linux';
export { NapiRsKeyringSecureStorage } from './secure-storage/secure-storage.napi-rs-keyring';
export { MacOSSecureStorage } from './secure-storage/secure-storage.macos';

export class KeychainStorage implements ISecureStorage {
  private readonly storage: ISecureStorage;

  constructor(storage: ISecureStorage = createSecureStorage()) {
    this.storage = storage;
  }

  getBackendType(): SecureStorageBackend {
    return this.storage.getBackendType();
  }

  async get(key: string): Promise<Buffer | null> {
    return this.storage.get(key);
  }

  async set(key: string, value: Buffer): Promise<void> {
    await this.storage.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.storage.delete(key);
  }
}
