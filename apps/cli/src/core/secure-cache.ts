import { secureWipe } from './crypto-utils';

export type ISecureCacheKey = `${string}:${string}`;

interface ICacheEntry {
  value: Buffer;
  timerId: ReturnType<typeof setTimeout>;
}

export const SESSION_MEMO_TTL_MS = 60 * 60 * 1000;

export function createSecureCacheKey(
  walletId: string,
  keyId: string,
): ISecureCacheKey {
  return `${walletId}:${keyId}`;
}

export class SecureCache {
  private cache = new Map<string, ICacheEntry>();

  set(
    key: ISecureCacheKey,
    value: Buffer,
    ttlMs: number = SESSION_MEMO_TTL_MS,
  ): void {
    const effectiveTtl = ttlMs <= 0 ? SESSION_MEMO_TTL_MS : ttlMs;
    this.delete(key);

    const timerId: ReturnType<typeof setTimeout> = setTimeout(() => {
      this.delete(key);
    }, effectiveTtl);

    // Node.js setTimeout returns Timeout with unref(); CI tsconfig resolves to number
    const t = timerId as unknown as { unref?: () => void };
    t.unref?.();
    this.cache.set(key, { value, timerId });
  }

  get(key: ISecureCacheKey): Buffer | null {
    const entry = this.cache.get(key);
    return entry ? entry.value : null;
  }

  has(key: ISecureCacheKey): boolean {
    return this.cache.has(key);
  }

  delete(key: ISecureCacheKey): void {
    const entry = this.cache.get(key);
    if (entry) {
      secureWipe(entry.value);
      clearTimeout(entry.timerId);
      this.cache.delete(key);
    }
  }

  clearAll(): void {
    for (const entry of this.cache.values()) {
      secureWipe(entry.value);
      clearTimeout(entry.timerId);
    }
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export const secureCache = new SecureCache();
