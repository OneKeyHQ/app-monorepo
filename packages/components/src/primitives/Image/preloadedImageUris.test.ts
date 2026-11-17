import {
  clearPreloadedImageUrisForTest,
  isPreloadedImageUri,
  markPreloadedImageUri,
} from './preloadedImageUris';

const uriAt = (index: number) => `https://example.com/icon-${index}.png`;

describe('preloadedImageUris', () => {
  beforeEach(() => {
    clearPreloadedImageUrisForTest();
  });

  test('ignores empty uris', () => {
    markPreloadedImageUri('');
    expect(isPreloadedImageUri('')).toBe(false);
  });

  // Mirrors react-native-web's 256-entry ImageUriCache so the registry never
  // outlives the cache that actually decides the first-frame paint.
  test('drops the oldest entries beyond the react-native-web cache size', () => {
    for (let index = 0; index < 300; index += 1) {
      markPreloadedImageUri(uriAt(index));
    }

    expect(isPreloadedImageUri(uriAt(0))).toBe(false);
    expect(isPreloadedImageUri(uriAt(43))).toBe(false);
    expect(isPreloadedImageUri(uriAt(44))).toBe(true);
    expect(isPreloadedImageUri(uriAt(299))).toBe(true);
  });

  test('treats a repeated prefetch as recent', () => {
    for (let index = 0; index < 256; index += 1) {
      markPreloadedImageUri(uriAt(index));
    }
    markPreloadedImageUri(uriAt(0));
    markPreloadedImageUri(uriAt(256));

    expect(isPreloadedImageUri(uriAt(0))).toBe(true);
    expect(isPreloadedImageUri(uriAt(1))).toBe(false);
    expect(isPreloadedImageUri(uriAt(256))).toBe(true);
  });
});
