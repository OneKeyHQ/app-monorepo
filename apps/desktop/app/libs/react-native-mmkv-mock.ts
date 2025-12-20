// Mock for react-native-mmkv
// In-memory storage implementation for MMKV interface

class MMKV {
  private storage: Map<string, boolean | string | number | ArrayBuffer>;

  private listeners: Set<(changedKey: string) => void>;

  constructor(options: { id: string }) {
    this.storage = new Map();
    this.listeners = new Set();
  }

  set(key: string, value: boolean | string | number | ArrayBuffer): void {
    this.storage.set(key, value);
    this.notifyListeners(key);
  }

  getString(key: string): string | undefined {
    const value = this.storage.get(key);
    return typeof value === 'string' ? value : undefined;
  }

  getNumber(key: string): number | undefined {
    const value = this.storage.get(key);
    return typeof value === 'number' ? value : undefined;
  }

  getBoolean(key: string): boolean | undefined {
    const value = this.storage.get(key);
    return typeof value === 'boolean' ? value : undefined;
  }

  getBuffer(key: string): ArrayBuffer | undefined {
    const value = this.storage.get(key);
    return value as ArrayBuffer | undefined;
  }

  getAllKeys(): string[] {
    return Array.from(this.storage.keys());
  }

  recrypt(_key: string | undefined): void {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error('Method not implemented.');
  }

  remove(key: string): boolean {
    const result = this.storage.delete(key);
    this.notifyListeners(key);
    return result;
  }

  contains(key: string): boolean {
    return this.storage.has(key);
  }

  clearAll(): void {
    const keys = Array.from(this.storage.keys());
    this.storage.clear();
    keys.forEach((key) => this.notifyListeners(key));
  }

  addOnValueChangedListener(listener: (changedKey: string) => void): {
    remove: () => void;
  } {
    this.listeners.add(listener);
    return {
      remove: () => {
        this.listeners.delete(listener);
      },
    };
  }

  private notifyListeners(key: string): void {
    this.listeners.forEach((listener) => listener(key));
  }
}

export const createMMKV = (options: { id: string }): MMKV => new MMKV(options);
