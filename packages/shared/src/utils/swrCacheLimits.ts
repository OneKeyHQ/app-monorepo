export const SWR_CACHE_MAX_ENTRIES = 1000;
export const SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS = 5 * 1024 * 1024;
export const SWR_CACHE_MAX_SERIALIZED_CHARS = 100 * 1024 * 1024;
export const SWR_CACHE_MAX_KEY_CHARS = 20_000;
export const SWR_CACHE_MAX_KEY_UTF8_BYTES = 59_000;

function getUtf8ByteLength(value: string) {
  let byteLength = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      byteLength += 1;
    } else if (codePoint <= 0x7_ff) {
      byteLength += 2;
    } else if (codePoint <= 0xff_ff) {
      byteLength += 3;
    } else {
      byteLength += 4;
    }
  }
  return byteLength;
}

export function isValidSWRCacheKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= SWR_CACHE_MAX_KEY_CHARS &&
    getUtf8ByteLength(value) <= SWR_CACHE_MAX_KEY_UTF8_BYTES
  );
}
