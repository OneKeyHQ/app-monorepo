/* eslint-disable no-useless-constructor, @typescript-eslint/no-useless-constructor */
export class MMKV {
  constructor(_options?: { id?: string }) {
    // Mock implementation
  }

  static createMMKV(_options?: { id?: string }) {
    return new MMKV(_options);
  }

  set(_key: string, _value: string | number | boolean): void {
    // Mock implementation
  }

  getString(_key: string): string | undefined {
    // Mock implementation
    return undefined;
  }

  getNumber(_key: string): number | undefined {
    // Mock implementation
    return undefined;
  }

  getBoolean(_key: string): boolean | undefined {
    // Mock implementation
    return undefined;
  }

  remove(_key: string): void {
    // Mock implementation
  }

  clearAll(): void {
    // Mock implementation
  }

  getAllKeys(): string[] {
    // Mock implementation
    return [];
  }
}
