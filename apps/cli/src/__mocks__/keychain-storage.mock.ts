export class KeychainStorageMock {
  private readonly store = new Map<string, Buffer>();

  constructor(initialEntries?: Iterable<readonly [string, Buffer]>) {
    if (initialEntries) {
      for (const [key, value] of initialEntries) {
        this.store.set(key, Buffer.from(value));
      }
    }
  }

  async get(key: string): Promise<Buffer | null> {
    const value = this.store.get(key);
    return value ? Buffer.from(value) : null;
  }

  async set(key: string, value: Buffer): Promise<void> {
    this.store.set(key, Buffer.from(value));
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export function createKeychainStorageMock(
  initialEntries?: Iterable<readonly [string, Buffer]>,
): KeychainStorageMock {
  return new KeychainStorageMock(initialEntries);
}
