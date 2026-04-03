import type { IOneKeyApiResponse } from '../infra/api-client';

/**
 * Create a mock OneKey API success response
 */
export function mockApiSuccess<T>(data: T): IOneKeyApiResponse<T> {
  return { code: 0, message: 'ok', data };
}

/**
 * Create a mock OneKey API error response
 */
export function mockApiError(
  code: number,
  message: string,
): IOneKeyApiResponse<never> {
  return { code, message, data: undefined as never };
}

/**
 * In-memory mock for SecureStorage interface (used in Phase 1+)
 */
export class MockKeychainStorage {
  private store = new Map<string, Buffer>();

  async get(key: string): Promise<Buffer | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: Buffer): Promise<void> {
    this.store.set(key, Buffer.from(value));
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
