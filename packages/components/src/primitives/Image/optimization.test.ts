import { buildOptimizedImageSource } from './optimization';

import type { ImageURISource } from 'react-native';

describe('Image optimization', () => {
  test('builds an optimized source from static numeric dimensions', () => {
    const resolvedSource: ImageURISource = {
      uri: 'https://uni.onekey-asset.com/icons/token.png',
    };

    const result = buildOptimizedImageSource({
      source: resolvedSource,
      resolvedSource,
      width: 20,
      height: 20,
      pixelRatio: 2,
    });

    expect(result.optimized).toBe(true);
    expect(result.rawSource).toBe(resolvedSource);
    expect(result.source?.uri).toBe(
      'https://uni.onekey-asset.com/icons/token.png?x-tos-process=image%2Fresize%2Cw_48',
    );
  });

  test('builds an optimized source from static token dimensions', () => {
    const resolvedSource: ImageURISource = {
      uri: 'https://uni.onekey-asset.com/icons/token.png',
    };

    const result = buildOptimizedImageSource({
      source: resolvedSource,
      resolvedSource,
      width: '$8',
      height: '$8',
      pixelRatio: 2,
    });

    expect(result.optimized).toBe(true);
    expect(result.source?.uri).toBe(
      'https://uni.onekey-asset.com/icons/token.png?x-tos-process=image%2Fresize%2Cw_96',
    );
  });

  test('builds an optimized source from a display resize width hint', () => {
    const resolvedSource: ImageURISource = {
      uri: 'https://uni.onekey-asset.com/icons/token.png',
    };

    const result = buildOptimizedImageSource({
      source: resolvedSource,
      resolvedSource,
      resizeWidth: 100,
      width: '100%',
      height: '100%',
      pixelRatio: 2,
    });

    expect(result.optimized).toBe(true);
    expect(result.source?.uri).toBe(
      'https://uni.onekey-asset.com/icons/token.png?x-tos-process=image%2Fresize%2Cw_256',
    );
  });

  test('skips a web bundle asset relative URI', () => {
    const resolvedSource: ImageURISource = {
      uri: 'static/media/avatar-fallback.c296a09f8e5ec6d58b36.png',
    };

    const result = buildOptimizedImageSource({
      source: resolvedSource,
      resolvedSource,
      resizeWidth: 40,
      pixelRatio: 2,
    });

    expect(result.optimized).toBe(false);
    expect(result.source).toBe(resolvedSource);
  });

  test('builds an optimized source from a web relative URI when allowed', () => {
    const resolvedSource: ImageURISource = {
      uri: 'static/media/avatar-fallback.c296a09f8e5ec6d58b36.png',
    };

    const result = buildOptimizedImageSource({
      source: resolvedSource,
      resolvedSource,
      resizeWidth: 40,
      pixelRatio: 2,
      allowRelativeUrl: true,
    });

    expect(result.optimized).toBe(true);
    expect(result.rawSource).toBe(resolvedSource);
    expect(result.source?.uri).toBe(
      'static/media/avatar-fallback.c296a09f8e5ec6d58b36.png?x-tos-process=image%2Fresize%2Cw_96',
    );
  });

  test('uses the larger static dimension when building a resize source', () => {
    const resolvedSource: ImageURISource = {
      uri: 'https://uni.onekey-asset.com/icons/poster.png',
    };

    const result = buildOptimizedImageSource({
      source: resolvedSource,
      resolvedSource,
      width: 32,
      height: 120,
      pixelRatio: 2,
    });

    expect(result.optimized).toBe(true);
    expect(result.source?.uri).toBe(
      'https://uni.onekey-asset.com/icons/poster.png?x-tos-process=image%2Fresize%2Cw_320',
    );
  });

  test('skips auto or percentage dimensions', () => {
    const resolvedSource: ImageURISource = {
      uri: 'https://uni.onekey-asset.com/icons/token.png',
    };

    const result = buildOptimizedImageSource({
      source: resolvedSource,
      resolvedSource,
      width: '100%',
      height: 20,
    });

    expect(result.optimized).toBe(false);
    expect(result.source).toBe(resolvedSource);
  });

  test('skips sources with custom headers', () => {
    const resolvedSource: ImageURISource = {
      headers: { Authorization: 'Bearer token' },
      uri: 'https://uni.onekey-asset.com/icons/token.png',
    };

    const result = buildOptimizedImageSource({
      source: resolvedSource,
      resolvedSource,
      width: 20,
      height: 20,
    });

    expect(result.optimized).toBe(false);
    expect(result.source).toBe(resolvedSource);
  });
});
