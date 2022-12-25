interface CachedValue<T> {
  value: T;
  timestamp: number;
  validate?: (value: T) => boolean;
}

interface CacheConfig<T> {
  cacheValue: boolean;
  validate?: (value: T) => boolean;
}

export class Cache {
  public expirationTime: number;

  public constructor(expirationTime: number) {
    this.expirationTime = expirationTime;
  }

  private readonly cachedValues: Map<string, CachedValue<any>> = new Map();

  private readonly promises: Map<string, Promise<any>> = new Map();

  public async get<T>(key: string): Promise<T> {
    const promise = this.promises.get(key);
    if (promise) {
      return promise as T;
    }

    const cached = this.cachedValues.get(key);
    if (cached && this.isValidOrDelete(key, cached)) {
      return cached.value as T;
    }

    return Promise.reject(new Error('No valid cached value.'));
  }

  public async save<T>(
    key: string,
    promise: Promise<T>,
    config: CacheConfig<T> = { cacheValue: true },
  ): Promise<T> {
    const newPromise = promise
      .then((value) => {
        if (value !== undefined && value !== null && config.cacheValue) {
          this.cachedValues.set(key, {
            value,
            timestamp: new Date().getTime(),
          });
        }

        return value;
      })
      .finally(() => this.promises.delete(key));

    this.promises.set(key, newPromise);

    return newPromise;
  }

  public delete(key: string) {
    this.promises.delete(key);
  }

  private isValidOrDelete(key: string, cached: CachedValue<any>): boolean {
    const expired =
      cached.timestamp + this.expirationTime < new Date().getTime() ||
      (cached.validate !== undefined && !cached.validate(cached.value));

    if (expired) {
      this.cachedValues.delete(key);
    }

    return !expired;
  }
}
