import { createHash } from 'node:crypto';

import {
  cacheTradingViewCompletionMarker,
  matchVerifiedTradingViewCachedResponse,
  putTradingViewResponseInCache,
} from './tradingViewEmbedCache';

function createAsset(body) {
  const encoded = new TextEncoder().encode(body);
  return {
    file: 'entry.js',
    integrity: `sha384-${createHash('sha384').update(encoded).digest('base64')}`,
    size: encoded.byteLength,
  };
}

describe('putTradingViewResponseInCache', () => {
  test('does not reject when Cache Storage is unavailable', async () => {
    const response = new Response('verified asset');
    const cache = {
      put: jest.fn(() => Promise.reject(new Error('QuotaExceededError'))),
    };

    await expect(
      putTradingViewResponseInCache(
        cache,
        new Request('https://tradingview.onekey.so/v1/embed/entry.js'),
        response,
      ),
    ).resolves.toBe(false);
    await expect(response.text()).resolves.toBe('verified asset');
  });

  test('reports successful Cache Storage writes', async () => {
    const cache = { put: jest.fn(() => Promise.resolve()) };

    await expect(
      putTradingViewResponseInCache(
        cache,
        new Request('https://tradingview.onekey.so/v1/embed/entry.js'),
        new Response('verified asset'),
      ),
    ).resolves.toBe(true);
  });
});

describe('matchVerifiedTradingViewCachedResponse', () => {
  const request = new Request(
    'https://tradingview.onekey.so/v1/embed/entry.js',
  );

  test('returns a cached body only after SHA-384 verification', async () => {
    const body = 'verified asset';
    const cache = {
      match: jest.fn(async () => new Response(body)),
      delete: jest.fn(async () => true),
    };

    const cachedResponse = await matchVerifiedTradingViewCachedResponse(
      cache,
      request,
      createAsset(body),
    );

    await expect(cachedResponse?.text()).resolves.toBe(body);
    expect(cache.delete).not.toHaveBeenCalled();
  });

  test('evicts a cache hit whose digest does not match the manifest', async () => {
    const cache = {
      match: jest.fn(async () => new Response('tampered asset')),
      delete: jest.fn(async () => true),
    };

    await expect(
      matchVerifiedTradingViewCachedResponse(
        cache,
        request,
        createAsset('verified asset'),
      ),
    ).resolves.toBeUndefined();
    expect(cache.delete).toHaveBeenCalledWith(request);
  });

  test('does not return a tampered body when eviction fails', async () => {
    const cache = {
      match: jest.fn(async () => new Response('tampered asset')),
      delete: jest.fn(() => Promise.reject(new Error('QuotaExceededError'))),
    };

    await expect(
      matchVerifiedTradingViewCachedResponse(
        cache,
        request,
        createAsset('verified asset'),
      ),
    ).resolves.toBeUndefined();
  });

  test('returns undefined on a cache miss without deleting', async () => {
    const cache = {
      match: jest.fn(async () => undefined),
      delete: jest.fn(async () => true),
    };

    await expect(
      matchVerifiedTradingViewCachedResponse(
        cache,
        request,
        createAsset('verified asset'),
      ),
    ).resolves.toBeUndefined();
    expect(cache.delete).not.toHaveBeenCalled();
  });
});

describe('cacheTradingViewCompletionMarker', () => {
  const manifestRequest = new Request(
    'https://tradingview.onekey.so/embed/latest.json',
  );

  test('does not mark an incomplete release as offline-ready', async () => {
    const cache = { put: jest.fn(() => Promise.resolve()) };

    await expect(
      cacheTradingViewCompletionMarker(
        cache,
        manifestRequest,
        new Response('{}'),
        false,
      ),
    ).resolves.toBe(false);
    expect(cache.put).not.toHaveBeenCalled();
  });

  test('stores the marker after every release asset is cached', async () => {
    const cache = { put: jest.fn(() => Promise.resolve()) };

    await expect(
      cacheTradingViewCompletionMarker(
        cache,
        manifestRequest,
        new Response('{}'),
        true,
      ),
    ).resolves.toBe(true);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });
});
