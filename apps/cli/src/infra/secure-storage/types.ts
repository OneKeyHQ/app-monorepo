type ISecureStorageBackend = 'macos-keychain' | 'linux-secret-service';

export interface ISecureStorage {
  getBackendType(): ISecureStorageBackend;
  get(key: string): Promise<Buffer | null>;
  set(key: string, value: Buffer): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface IProcessRunner {
  execFileAsync(
    cmd: string,
    args: string[],
  ): Promise<{ stdout: string; stderr: string }>;
  spawnWithStdin(
    cmd: string,
    args: string[],
    input: string,
  ): Promise<{ stdout: string; stderr: string }>;
}

export type { ISecureStorageBackend as SecureStorageBackend };
