import { secureWipe } from './crypto-utils';

interface ICacheEntry {
  value: Buffer;
  timerId: ReturnType<typeof setTimeout>;
}

const DEFAULT_TTL_MS = 1_800_000; // 30 minutes

export class SecureCache {
  private cache = new Map<string, ICacheEntry>();

  set(key: string, value: Buffer, ttlMs: number = DEFAULT_TTL_MS): void {
    const effectiveTtl = ttlMs <= 0 ? DEFAULT_TTL_MS : ttlMs;
    this.delete(key);

    const timerId: ReturnType<typeof setTimeout> = setTimeout(() => {
      this.delete(key);
    }, effectiveTtl);

    // Node.js setTimeout returns Timeout with unref(); CI tsconfig resolves to number
    const t = timerId as unknown as { unref?: () => void };
    t.unref?.();
    this.cache.set(key, { value, timerId });
  }

  get(key: string): Buffer | null {
    const entry = this.cache.get(key);
    return entry ? entry.value : null;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): void {
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
