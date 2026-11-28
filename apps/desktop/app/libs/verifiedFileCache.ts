// In-memory cache of file buffers that the `file:` protocol handler already
// read (and, for OTA bundles, sha512-verified). Chromium fetches <video> and
// <audio> sources as a series of HTTP Range requests and re-requests them on
// every play; without this cache each range request re-reads the whole file
// and re-hashes it synchronously on the main process.
//
// Integrity: entries hold the exact bytes that passed verification, keyed by
// file path plus the expected sha512. A cache hit serves those verified bytes
// and never re-reads the disk, so later on-disk tampering cannot reach the
// renderer through the cache, and a metadata change (new bundle / new hash)
// produces a different key.

export type IVerifiedFileCache = {
  get: (filePath: string, sha512?: string) => Buffer | undefined;
  set: (filePath: string, sha512: string | undefined, buffer: Buffer) => void;
  clear: () => void;
  readonly totalBytes: number;
  readonly size: number;
};

// Bundled media is a few MB at most (largest onboarding video ~2.4 MB), so a
// small budget keeps every clip warm without holding JS chunks in memory.
export const DEFAULT_VERIFIED_FILE_CACHE_MAX_BYTES = 32 * 1024 * 1024;
export const DEFAULT_VERIFIED_FILE_CACHE_MAX_ENTRY_BYTES = 8 * 1024 * 1024;

const getCacheKey = (filePath: string, sha512?: string) =>
  `${filePath}\u0000${sha512 ?? ''}`;

export function createVerifiedFileCache({
  maxBytes = DEFAULT_VERIFIED_FILE_CACHE_MAX_BYTES,
  maxEntryBytes = DEFAULT_VERIFIED_FILE_CACHE_MAX_ENTRY_BYTES,
}: {
  maxBytes?: number;
  maxEntryBytes?: number;
} = {}): IVerifiedFileCache {
  // Map iteration order is insertion order; re-inserting on hit gives LRU.
  const entries = new Map<string, Buffer>();
  let totalBytes = 0;

  const remove = (key: string) => {
    const existing = entries.get(key);
    if (existing) {
      totalBytes -= existing.byteLength;
      entries.delete(key);
    }
  };

  return {
    get(filePath, sha512) {
      const key = getCacheKey(filePath, sha512);
      const buffer = entries.get(key);
      if (buffer) {
        entries.delete(key);
        entries.set(key, buffer);
      }
      return buffer;
    },
    set(filePath, sha512, buffer) {
      const key = getCacheKey(filePath, sha512);
      remove(key);
      if (buffer.byteLength > maxEntryBytes || buffer.byteLength > maxBytes) {
        return;
      }
      while (totalBytes + buffer.byteLength > maxBytes && entries.size > 0) {
        const oldestKey = entries.keys().next().value as string;
        remove(oldestKey);
      }
      entries.set(key, buffer);
      totalBytes += buffer.byteLength;
    },
    clear() {
      entries.clear();
      totalBytes = 0;
    },
    get totalBytes() {
      return totalBytes;
    },
    get size() {
      return entries.size;
    },
  };
}

export function isRangeRequest(request?: Pick<Request, 'headers'>): boolean {
  return Boolean(request?.headers?.get('range'));
}
