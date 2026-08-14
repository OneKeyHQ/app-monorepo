import {
  TOS_IMAGE_RESIZE_WIDTH_BUCKETS,
  buildTosImageResizeUrl,
  getTosImageResizeTargetWidth,
} from './tosImageResizeUtils';

describe('tosImageResizeUtils', () => {
  test('optimizes a whitelisted image URL with a stable DPR width bucket', () => {
    const result = buildTosImageResizeUrl({
      uri: 'https://uni.onekey-asset.com/icons/token.png',
      displayWidth: 20,
      displayHeight: 20,
      pixelRatio: 2,
    });

    expect(result).toEqual({
      optimized: true,
      targetWidth: 48,
      uri: 'https://uni.onekey-asset.com/icons/token.png?x-tos-process=image%2Fresize%2Cw_48',
    });
  });

  test('preserves existing query params and hash when adding resize params', () => {
    const result = buildTosImageResizeUrl({
      uri: 'https://common.onekey-asset.com/a/b/logo.jpeg?foo=bar#preview',
      displayWidth: 64,
      displayHeight: 32,
      pixelRatio: 3,
    });

    expect(result.optimized).toBe(true);
    expect(result.targetWidth).toBe(256);
    expect(result.uri).toBe(
      'https://common.onekey-asset.com/a/b/logo.jpeg?foo=bar&x-tos-process=image%2Fresize%2Cw_256#preview',
    );
  });

  test('uses the larger display dimension to avoid undersized portrait images', () => {
    const result = buildTosImageResizeUrl({
      uri: 'https://common.onekey-asset.com/a/b/poster.jpeg',
      displayWidth: 32,
      displayHeight: 120,
      pixelRatio: 2,
    });

    expect(result.optimized).toBe(true);
    expect(result.targetWidth).toBe(320);
  });

  test('uses a resize width hint as display width without requiring exact layout dimensions', () => {
    const result = buildTosImageResizeUrl({
      uri: 'https://uni.onekey-asset.com/icons/token.png',
      resizeWidth: 100,
      pixelRatio: 2,
    });

    expect(result).toEqual({
      optimized: true,
      targetWidth: 256,
      uri: 'https://uni.onekey-asset.com/icons/token.png?x-tos-process=image%2Fresize%2Cw_256',
    });
  });

  test('optimizes web bundle image assets served from app-assets', () => {
    const result = buildTosImageResizeUrl({
      uri: 'https://app-assets.onekey.so/release/static/media/avatar-fallback.c296a09f8e5ec6d58b36.png',
      resizeWidth: 40,
      pixelRatio: 2,
    });

    expect(result).toEqual({
      optimized: true,
      targetWidth: 96,
      uri: 'https://app-assets.onekey.so/release/static/media/avatar-fallback.c296a09f8e5ec6d58b36.png?x-tos-process=image%2Fresize%2Cw_96',
    });
  });

  test('optimizes relative image URLs only when explicitly allowed', () => {
    expect(
      buildTosImageResizeUrl({
        uri: 'static/media/avatar-fallback.c296a09f8e5ec6d58b36.png',
        resizeWidth: 40,
        pixelRatio: 2,
      }),
    ).toEqual({
      optimized: false,
      skipReason: 'invalidUrl',
      uri: 'static/media/avatar-fallback.c296a09f8e5ec6d58b36.png',
    });

    expect(
      buildTosImageResizeUrl({
        uri: 'static/media/avatar-fallback.c296a09f8e5ec6d58b36.png?foo=bar#preview',
        resizeWidth: 40,
        pixelRatio: 2,
        allowRelativeUrl: true,
      }),
    ).toEqual({
      optimized: true,
      targetWidth: 96,
      uri: 'static/media/avatar-fallback.c296a09f8e5ec6d58b36.png?foo=bar&x-tos-process=image%2Fresize%2Cw_96#preview',
    });
  });

  test('optimizes slash-prefixed relative image URLs when explicitly allowed', () => {
    const result = buildTosImageResizeUrl({
      uri: '/static/media/avatar-fallback.c296a09f8e5ec6d58b36.png',
      resizeWidth: 40,
      pixelRatio: 2,
      allowRelativeUrl: true,
    });

    expect(result).toEqual({
      optimized: true,
      targetWidth: 96,
      uri: '/static/media/avatar-fallback.c296a09f8e5ec6d58b36.png?x-tos-process=image%2Fresize%2Cw_96',
    });
  });

  test('prefers the resize width hint over static display dimensions', () => {
    const result = buildTosImageResizeUrl({
      uri: 'https://uni.onekey-asset.com/icons/token.png',
      resizeWidth: 80,
      displayWidth: 400,
      displayHeight: 800,
      pixelRatio: 2,
    });

    expect(result.optimized).toBe(true);
    expect(result.targetWidth).toBe(200);
  });

  test('requires exact whitelisted hosts', () => {
    const result = buildTosImageResizeUrl({
      uri: 'https://uni.onekey-asset.com.evil.com/icons/token.png',
      displayWidth: 20,
      displayHeight: 20,
      pixelRatio: 2,
    });

    expect(result).toEqual({
      optimized: false,
      skipReason: 'unsupportedHost',
      uri: 'https://uni.onekey-asset.com.evil.com/icons/token.png',
    });
  });

  test.each([
    'http://uni.onekey-asset.com/icons/token.png',
    'https://cdn.jsdelivr.net/npm/@onekeyfe/chain-list/assets/eth/logo.png',
    'data:image/png;base64,abc',
    'blob:https://app.onekey.so/abc',
    'file:///tmp/token.png',
  ])('skips unsupported URL %s', (uri) => {
    const result = buildTosImageResizeUrl({
      uri,
      displayWidth: 20,
      displayHeight: 20,
      pixelRatio: 2,
    });

    expect(result.optimized).toBe(false);
  });

  test('skips URLs that already contain x-tos-process', () => {
    const uri =
      'https://uni.onekey-asset.com/icons/token.png?x-tos-process=image/resize,w_200';
    const result = buildTosImageResizeUrl({
      uri,
      displayWidth: 20,
      displayHeight: 20,
      pixelRatio: 2,
    });

    expect(result).toEqual({
      optimized: false,
      skipReason: 'alreadyProcessed',
      uri,
    });
  });

  test.each([
    'https://uni.onekey-asset.com/icons/token.png?X-Amz-Signature=abc',
    'https://uni.onekey-asset.com/icons/token.png?Expires=123',
    'https://uni.onekey-asset.com/icons/token.png?auth_key=abc',
    'https://uni.onekey-asset.com/icons/token.png?security-token=abc',
  ])('skips signed or auth URL %s', (uri) => {
    const result = buildTosImageResizeUrl({
      uri,
      displayWidth: 20,
      displayHeight: 20,
      pixelRatio: 2,
    });

    expect(result).toEqual({
      optimized: false,
      skipReason: 'signedUrl',
      uri,
    });
  });

  test.each([
    'https://uni.onekey-asset.com/icons/token.svg',
    'https://uni.onekey-asset.com/videos/intro.mp4',
  ])('skips unsupported media format %s', (uri) => {
    const result = buildTosImageResizeUrl({
      uri,
      displayWidth: 20,
      displayHeight: 20,
      pixelRatio: 2,
    });

    expect(result).toEqual({
      optimized: false,
      skipReason: 'unsupportedExtension',
      uri,
    });
  });

  test('skips unknown or non-static display sizes', () => {
    expect(
      buildTosImageResizeUrl({
        uri: 'https://uni.onekey-asset.com/icons/token.png',
        displayWidth: undefined,
        displayHeight: 20,
        pixelRatio: 2,
      }),
    ).toEqual({
      optimized: false,
      skipReason: 'unknownSize',
      uri: 'https://uni.onekey-asset.com/icons/token.png',
    });

    expect(
      buildTosImageResizeUrl({
        uri: 'https://uni.onekey-asset.com/icons/token.png',
        displayWidth: 20,
        displayHeight: 0,
        pixelRatio: 2,
      }),
    ).toEqual({
      optimized: false,
      skipReason: 'unknownSize',
      uri: 'https://uni.onekey-asset.com/icons/token.png',
    });
  });

  test('uses fixed width buckets instead of arbitrary target widths', () => {
    expect(
      getTosImageResizeTargetWidth({ displayWidth: 40, pixelRatio: 2 }),
    ).toBe(96);
    expect(
      getTosImageResizeTargetWidth({ resizeWidth: 100, pixelRatio: 2 }),
    ).toBe(256);
    expect(TOS_IMAGE_RESIZE_WIDTH_BUCKETS).toEqual([
      32, 40, 48, 64, 96, 128, 160, 200, 256, 320, 480, 640, 960, 1280,
    ]);
  });
});
