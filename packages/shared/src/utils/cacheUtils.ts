import stringify from 'fast-json-stable-stringify';
import cache from 'memoizee';

export type IMemoizeeOptions = cache.Options<any>;

type ICacheDisposeReason = 'delete' | 'evict' | 'expire' | 'set';

type ICacheOptions<TKey, TValue> = {
  max?: number;
  ttl?: number;
  ttlAutopurge?: boolean;
  dispose?: (value: TValue, key: TKey, reason: ICacheDisposeReason) => void;
};

type ICacheEntry<TValue> = {
  value: TValue;
  expiresAt: number | undefined;
};

export class LRUCache<TKey, TValue> {
  constructor(private readonly options: ICacheOptions<TKey, TValue> = {}) {}

  private cache = new Map<TKey, ICacheEntry<TValue>>();

  private autopurgeTimer: ReturnType<typeof setTimeout> | undefined;

  private get max() {
    return Math.max(0, this.options.max ?? Number.POSITIVE_INFINITY);
  }

  private getExpiresAt() {
    return this.options.ttl ? Date.now() + this.options.ttl : undefined;
  }

  private isExpired(entry: ICacheEntry<TValue>) {
    return Boolean(entry.expiresAt && entry.expiresAt <= Date.now());
  }

  private dispose(
    key: TKey,
    entry: ICacheEntry<TValue>,
    reason: ICacheDisposeReason,
  ) {
    this.options.dispose?.(entry.value, key, reason);
  }

  private purgeExpiredEntries() {
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.dispose(key, entry, 'expire');
      }
    }
  }

  private evictOverflow() {
    while (this.cache.size > this.max) {
      const oldest = this.cache.entries().next();
      if (oldest.done) {
        return;
      }
      const [key, entry] = oldest.value;
      this.cache.delete(key);
      this.dispose(key, entry, 'evict');
    }
  }

  private scheduleAutopurge() {
    if (!this.options.ttlAutopurge) {
      return;
    }
    if (this.autopurgeTimer) {
      clearTimeout(this.autopurgeTimer);
      this.autopurgeTimer = undefined;
    }
    let nextExpiresAt: number | undefined;
    for (const entry of this.cache.values()) {
      if (
        entry.expiresAt &&
        (!nextExpiresAt || entry.expiresAt < nextExpiresAt)
      ) {
        nextExpiresAt = entry.expiresAt;
      }
    }
    if (!nextExpiresAt) {
      return;
    }
    this.autopurgeTimer = setTimeout(
      () => {
        this.autopurgeTimer = undefined;
        this.purgeExpiredEntries();
        this.scheduleAutopurge();
      },
      Math.max(0, nextExpiresAt - Date.now()),
    );
  }

  get(key: TKey): TValue | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.dispose(key, entry, 'expire');
      this.scheduleAutopurge();
      return undefined;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: TKey, value: TValue): this {
    const previous = this.cache.get(key);
    if (previous) {
      this.cache.delete(key);
      this.dispose(key, previous, 'set');
    }
    this.cache.set(key, {
      value,
      expiresAt: this.getExpiresAt(),
    });
    this.evictOverflow();
    this.scheduleAutopurge();
    return this;
  }

  has(key: TKey): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: TKey): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    this.cache.delete(key);
    this.dispose(key, entry, 'delete');
    this.scheduleAutopurge();
    return true;
  }

  clear(): void {
    for (const [key, entry] of this.cache) {
      this.dispose(key, entry, 'delete');
    }
    this.cache.clear();
    if (this.autopurgeTimer) {
      clearTimeout(this.autopurgeTimer);
      this.autopurgeTimer = undefined;
    }
  }

  *values(): IterableIterator<TValue> {
    this.purgeExpiredEntries();
    this.scheduleAutopurge();
    for (const entry of this.cache.values()) {
      yield entry.value;
    }
  }

  *keys(): IterableIterator<TKey> {
    this.purgeExpiredEntries();
    this.scheduleAutopurge();
    yield* this.cache.keys();
  }
}

export const memoizee: typeof cache = (f, options) => {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let { normalizer } = options ?? {};
  if (!normalizer) {
    normalizer = (...args) => {
      const result = stringify(args);
      return result;
    };
  }
  return cache(f, {
    ...options,
    normalizer,
  });
};

export function memoFn<T>(fn: () => T) {
  return memoizee(fn);
}

export default {
  memoizee,
  memoFn,
  LRUCache,
};
