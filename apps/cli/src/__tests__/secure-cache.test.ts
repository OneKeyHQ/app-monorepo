import {
  SESSION_MEMO_TTL_MS,
  SecureCache,
  createSecureCacheKey,
  secureCache,
} from '../core/secure-cache';

function expectWiped(buffer: Buffer): void {
  expect(buffer.equals(Buffer.alloc(buffer.length))).toBe(true);
}

describe('SecureCache', () => {
  afterEach(() => {
    secureCache.clearAll();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('stores process-local values by walletId:keyId cache key', () => {
    const cache = new SecureCache();
    const key = createSecureCacheKey('wallet-1', 'key-1');
    const value = Buffer.from('hd-credential');

    cache.set(key, value);

    expect(key).toBe('wallet-1:key-1');
    expect(cache.get(key)).toBe(value);
    expect(cache.has(key)).toBe(true);
    expect(cache.size).toBe(1);
  });

  it('expires entries and wipes the cached buffer', () => {
    jest.useFakeTimers();
    const cache = new SecureCache();
    const key = createSecureCacheKey('wallet-1', 'key-1');
    const value = Buffer.from('secret');

    cache.set(key, value, 10);
    jest.advanceTimersByTime(10);

    expect(cache.get(key)).toBeNull();
    expect(cache.size).toBe(0);
    expectWiped(value);
  });

  it('unrefs the session memo timer', () => {
    const unref = jest.fn();
    const timerId = { unref } as unknown as ReturnType<typeof setTimeout>;
    const setTimeoutSpy = jest.spyOn(
      globalThis,
      'setTimeout',
    ) as jest.SpiedFunction<typeof setTimeout>;
    setTimeoutSpy.mockImplementation(((
      handler: () => void,
      timeout?: number,
    ) => {
      void handler;
      void timeout;
      return timerId;
    }) as typeof setTimeout);
    const clearTimeoutSpy = jest.spyOn(
      globalThis,
      'clearTimeout',
    ) as jest.SpiedFunction<typeof clearTimeout>;
    clearTimeoutSpy.mockImplementation(
      (() => undefined) as typeof clearTimeout,
    );

    const cache = new SecureCache();
    cache.set(createSecureCacheKey('wallet-1', 'key-1'), Buffer.from('value'));

    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      SESSION_MEMO_TTL_MS,
    );
    expect(unref).toHaveBeenCalledTimes(1);

    cache.clearAll();
  });

  it('clearAll wipes every cached value', () => {
    const cache = new SecureCache();
    const first = Buffer.from('first-secret');
    const second = Buffer.from('second-secret');

    cache.set(createSecureCacheKey('wallet-1', 'key-1'), first);
    cache.set(createSecureCacheKey('wallet-2', 'key-2'), second);
    cache.clearAll();

    expect(cache.size).toBe(0);
    expectWiped(first);
    expectWiped(second);
  });

  it('rejects standalone walletId or keyId strings at the type layer', () => {
    function assertTypes() {
      const cacheKey = createSecureCacheKey('wallet-1', 'key-1');
      secureCache.get(cacheKey);
      secureCache.set(cacheKey, Buffer.from('value'));

      // @ts-expect-error keyId alone is not a walletId:keyId cache key.
      secureCache.get('key-1');
      // @ts-expect-error walletId alone is not a walletId:keyId cache key.
      secureCache.set('wallet-1', Buffer.from('value'));
    }

    expect(createSecureCacheKey('wallet-1', 'key-1')).toBe('wallet-1:key-1');
    void assertTypes;
  });
});
