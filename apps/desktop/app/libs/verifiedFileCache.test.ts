import { createVerifiedFileCache, isRangeRequest } from './verifiedFileCache';

describe('verifiedFileCache', () => {
  test('keys entries by file path and expected sha512', () => {
    const cache = createVerifiedFileCache();
    const buf = Buffer.from('video');
    cache.set('/bundle/clip.mp4', 'hash-a', buf);

    expect(cache.get('/bundle/clip.mp4', 'hash-a')).toBe(buf);
    expect(cache.get('/bundle/clip.mp4', 'hash-b')).toBeUndefined();
    expect(cache.get('/bundle/clip.mp4')).toBeUndefined();
    expect(cache.get('/bundle/other.mp4', 'hash-a')).toBeUndefined();
  });

  test('skips entries over the per-entry limit', () => {
    const cache = createVerifiedFileCache({ maxBytes: 100, maxEntryBytes: 10 });
    cache.set('/a', undefined, Buffer.alloc(11));
    expect(cache.get('/a')).toBeUndefined();
    expect(cache.size).toBe(0);
    expect(cache.totalBytes).toBe(0);
  });

  test('evicts least recently used entries to stay within the byte budget', () => {
    const cache = createVerifiedFileCache({ maxBytes: 30, maxEntryBytes: 30 });
    cache.set('/a', undefined, Buffer.alloc(10));
    cache.set('/b', undefined, Buffer.alloc(10));
    cache.set('/c', undefined, Buffer.alloc(10));
    // touch /a so /b becomes the oldest
    expect(cache.get('/a')).toBeDefined();
    cache.set('/d', undefined, Buffer.alloc(10));

    expect(cache.get('/b')).toBeUndefined();
    expect(cache.get('/a')).toBeDefined();
    expect(cache.get('/c')).toBeDefined();
    expect(cache.get('/d')).toBeDefined();
    expect(cache.totalBytes).toBe(30);
  });

  test('replacing an entry keeps byte accounting accurate and clear resets it', () => {
    const cache = createVerifiedFileCache({
      maxBytes: 100,
      maxEntryBytes: 100,
    });
    cache.set('/a', 'h', Buffer.alloc(10));
    cache.set('/a', 'h', Buffer.alloc(20));
    expect(cache.size).toBe(1);
    expect(cache.totalBytes).toBe(20);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.totalBytes).toBe(0);
  });

  test('isRangeRequest only matches requests with a Range header', () => {
    expect(
      isRangeRequest({ headers: new Headers({ Range: 'bytes=0-' }) }),
    ).toBe(true);
    expect(isRangeRequest({ headers: new Headers() })).toBe(false);
    expect(isRangeRequest(undefined)).toBe(false);
  });
});
