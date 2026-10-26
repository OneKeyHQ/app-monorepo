// URIs that went through `Image.prefetch` in this session. react-native-web
// seeds its own ImageUriCache from prefetch alone (a displayed image never
// enters it), and that cache is what lets a freshly mounted <Image> start in
// the LOADED state and paint in its first commit instead of after an effect.
//
// Capped at the same size as that cache so a URI it has evicted is not kept
// here indefinitely; an entry dropped on either side only falls back to the
// lazy path, never to a wrong paint.
const PRELOADED_IMAGE_URI_LIMIT = 256;

const preloadedImageUris = new Set<string>();

export function markPreloadedImageUri(uri: string) {
  if (!uri) {
    return;
  }
  // Re-insert so the Set's insertion order doubles as recency.
  preloadedImageUris.delete(uri);
  preloadedImageUris.add(uri);
  while (preloadedImageUris.size > PRELOADED_IMAGE_URI_LIMIT) {
    const oldest = preloadedImageUris.values().next().value;
    if (oldest === undefined) {
      break;
    }
    preloadedImageUris.delete(oldest);
  }
}

export function isPreloadedImageUri(uri: string) {
  return Boolean(uri) && preloadedImageUris.has(uri);
}

export function clearPreloadedImageUrisForTest() {
  preloadedImageUris.clear();
}
