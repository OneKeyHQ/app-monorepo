// URIs that went through `Image.prefetch` in this session. react-native-web
// seeds its own ImageUriCache from prefetch alone (a displayed image never
// enters it), and that cache is what lets a freshly mounted <Image> start in
// the LOADED state and paint in its first commit instead of after an effect.
const preloadedImageUris = new Set<string>();

export function markPreloadedImageUri(uri: string) {
  if (uri) {
    preloadedImageUris.add(uri);
  }
}

export function isPreloadedImageUri(uri: string) {
  return Boolean(uri) && preloadedImageUris.has(uri);
}

export function clearPreloadedImageUrisForTest() {
  preloadedImageUris.clear();
}
