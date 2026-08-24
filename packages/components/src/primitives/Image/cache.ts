import { Image } from 'expo-image';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ImageLoadOptions, ImageRef, ImageSource } from 'expo-image';

const IMAGE_CACHE_MAP = new Map<string, string>();
const IMAGE_CACHE_PROMISE_MAP = new Map<string, Promise<string | undefined>>();
type IImageRefCacheEntry = {
  cacheKey: string;
  sourceUri: string;
  imageRef: ImageRef;
  refCount: number;
  lastUsedAt: number;
  invalidated?: boolean;
};

const IMAGE_REF_CACHE_MAP = new Map<string, IImageRefCacheEntry>();
const IMAGE_REF_PREFERRED_VARIANT_MAP = new Map<string, string>();
const IMAGE_REF_CACHE_PROMISE_MAP = new Map<
  string,
  Promise<ImageRef | undefined>
>();
const IMAGE_CACHE_PRIME_CONCURRENCY = 4;
const IMAGE_REF_CACHE_PRIME_CONCURRENCY = 3;
const IMAGE_REF_CACHE_MAX_SIZE = 128;

function getImageRefEntryKey(cacheKey: string, sourceUri: string) {
  return `${cacheKey}\u0000${sourceUri}`;
}

function getPreferredImageRefEntry(cacheKey: string) {
  const preferredEntryKey = IMAGE_REF_PREFERRED_VARIANT_MAP.get(cacheKey);
  const preferredEntry = preferredEntryKey
    ? IMAGE_REF_CACHE_MAP.get(preferredEntryKey)
    : undefined;
  if (preferredEntry && !preferredEntry.invalidated) {
    return preferredEntry;
  }

  const fallbackEntry = Array.from(IMAGE_REF_CACHE_MAP.values()).find(
    (entry) => entry.cacheKey === cacheKey && !entry.invalidated,
  );
  if (fallbackEntry) {
    IMAGE_REF_PREFERRED_VARIANT_MAP.set(
      cacheKey,
      getImageRefEntryKey(fallbackEntry.cacheKey, fallbackEntry.sourceUri),
    );
  } else {
    IMAGE_REF_PREFERRED_VARIANT_MAP.delete(cacheKey);
  }
  return fallbackEntry;
}

function getImageRefEntry(cacheKey?: string, sourceUri?: string) {
  if (!cacheKey) {
    return undefined;
  }
  if (sourceUri) {
    const exactEntry = IMAGE_REF_CACHE_MAP.get(
      getImageRefEntryKey(cacheKey, sourceUri),
    );
    if (exactEntry && !exactEntry.invalidated) {
      return exactEntry;
    }
  }
  return getPreferredImageRefEntry(cacheKey);
}

export function getCachedImagePath(uri?: string) {
  return uri ? IMAGE_CACHE_MAP.get(uri) : undefined;
}

export function getCachedImageRefInfo(cacheKey?: string, sourceUri?: string) {
  const entry = getImageRefEntry(cacheKey, sourceUri);
  if (!entry) {
    return undefined;
  }
  entry.lastUsedAt = Date.now();
  return {
    imageRef: entry.imageRef,
    sourceUri: entry.sourceUri,
  };
}

export function getCachedImageRef(cacheKey?: string, sourceUri?: string) {
  return getCachedImageRefInfo(cacheKey, sourceUri)?.imageRef;
}

export function hasExactCachedImageRef(cacheKey?: string, sourceUri?: string) {
  if (!cacheKey || !sourceUri) {
    return false;
  }
  const entry = IMAGE_REF_CACHE_MAP.get(
    getImageRefEntryKey(cacheKey, sourceUri),
  );
  return Boolean(entry && !entry.invalidated);
}

function releaseImageRef(imageRef: ImageRef) {
  try {
    imageRef.release();
  } catch {
    // ImageRef may already be released by native cleanup.
  }
}

function deleteImageRefCacheEntry(
  entryKey: string,
  entry: IImageRefCacheEntry,
) {
  IMAGE_REF_CACHE_MAP.delete(entryKey);
  if (IMAGE_REF_PREFERRED_VARIANT_MAP.get(entry.cacheKey) === entryKey) {
    IMAGE_REF_PREFERRED_VARIANT_MAP.delete(entry.cacheKey);
  }
  releaseImageRef(entry.imageRef);
}

function trimImageRefCache() {
  if (IMAGE_REF_CACHE_MAP.size <= IMAGE_REF_CACHE_MAX_SIZE) {
    return;
  }
  const releasableEntries = Array.from(IMAGE_REF_CACHE_MAP.entries())
    .filter(([, entry]) => entry.refCount <= 0)
    .toSorted(([, a], [, b]) => a.lastUsedAt - b.lastUsedAt);

  for (const [entryKey, entry] of releasableEntries) {
    if (IMAGE_REF_CACHE_MAP.size <= IMAGE_REF_CACHE_MAX_SIZE) {
      break;
    }
    deleteImageRefCacheEntry(entryKey, entry);
  }
}

export function retainCachedImageRef(
  cacheKey?: string,
  sourceUri?: string,
  imageRef?: ImageRef,
) {
  const entry = imageRef
    ? Array.from(IMAGE_REF_CACHE_MAP.values()).find(
        (candidate) =>
          candidate.cacheKey === cacheKey &&
          candidate.sourceUri === sourceUri &&
          candidate.imageRef === imageRef &&
          !candidate.invalidated,
      )
    : getImageRefEntry(cacheKey, sourceUri);
  if (!entry) {
    return undefined;
  }
  entry.refCount += 1;
  entry.lastUsedAt = Date.now();
  return entry.imageRef;
}

export function releaseCachedImageRef(
  cacheKey?: string,
  sourceUri?: string,
  imageRef?: ImageRef,
) {
  if (!cacheKey) {
    return;
  }
  const entry = imageRef
    ? Array.from(IMAGE_REF_CACHE_MAP.values()).find(
        (candidate) =>
          candidate.cacheKey === cacheKey &&
          (!sourceUri || candidate.sourceUri === sourceUri) &&
          candidate.imageRef === imageRef,
      )
    : (Array.from(IMAGE_REF_CACHE_MAP.values()).find(
        (candidate) =>
          candidate.cacheKey === cacheKey &&
          (!sourceUri || candidate.sourceUri === sourceUri),
      ) ?? getImageRefEntry(cacheKey, sourceUri));
  if (!entry) {
    return;
  }
  entry.refCount = Math.max(0, entry.refCount - 1);
  entry.lastUsedAt = Date.now();
  if (entry.invalidated && entry.refCount <= 0) {
    deleteImageRefCacheEntry(
      getImageRefEntryKey(entry.cacheKey, entry.sourceUri),
      entry,
    );
    return;
  }
  trimImageRefCache();
}

export function setCachedImagePath(uri: string, cachePath: string) {
  IMAGE_CACHE_MAP.set(uri, cachePath);
}

export function setCachedImageRef(
  cacheKey: string,
  imageRef: ImageRef,
  sourceUri = cacheKey,
) {
  const entryKey = getImageRefEntryKey(cacheKey, sourceUri);
  const existingEntry = IMAGE_REF_CACHE_MAP.get(entryKey);
  if (existingEntry) {
    if (existingEntry.invalidated && existingEntry.refCount <= 0) {
      deleteImageRefCacheEntry(entryKey, existingEntry);
    } else {
      existingEntry.lastUsedAt = Date.now();
      releaseImageRef(imageRef);
      return;
    }
  }
  IMAGE_REF_CACHE_MAP.set(entryKey, {
    cacheKey,
    sourceUri,
    imageRef,
    refCount: 0,
    lastUsedAt: Date.now(),
  });
  IMAGE_REF_PREFERRED_VARIANT_MAP.set(cacheKey, entryKey);
  trimImageRefCache();
}

/**
 * Transfers a newly loaded ImageRef to the iOS decoded-image cache and retains
 * one reference for the caller. The caller must balance a successful return
 * with releaseCachedImageRef() instead of releasing the ImageRef directly.
 */
export function cacheAndRetainImageRef(
  cacheKey: string,
  imageRef: ImageRef,
  sourceUri = cacheKey,
) {
  if (platformEnv.isNativeAndroid) {
    return undefined;
  }

  const entryKey = getImageRefEntryKey(cacheKey, sourceUri);
  const existingEntry = IMAGE_REF_CACHE_MAP.get(entryKey);
  if (existingEntry) {
    if (existingEntry.invalidated) {
      if (existingEntry.refCount <= 0) {
        deleteImageRefCacheEntry(entryKey, existingEntry);
      } else {
        return undefined;
      }
    } else {
      existingEntry.refCount += 1;
      existingEntry.lastUsedAt = Date.now();
      if (existingEntry.imageRef !== imageRef) {
        releaseImageRef(imageRef);
      }
      return existingEntry.imageRef;
    }
  }

  IMAGE_REF_CACHE_MAP.set(entryKey, {
    cacheKey,
    sourceUri,
    imageRef,
    refCount: 1,
    lastUsedAt: Date.now(),
  });
  IMAGE_REF_PREFERRED_VARIANT_MAP.set(cacheKey, entryKey);
  trimImageRefCache();
  return imageRef;
}

export function deleteCachedImagePath(uri?: string) {
  if (uri) {
    IMAGE_CACHE_MAP.delete(uri);
    for (const [entryKey, entry] of IMAGE_REF_CACHE_MAP) {
      if (entry.cacheKey === uri || entry.sourceUri === uri) {
        if (entry.refCount > 0) {
          entry.invalidated = true;
          entry.lastUsedAt = Date.now();
        } else {
          deleteImageRefCacheEntry(entryKey, entry);
        }
      }
    }
  }
}

export async function refreshCachedImagePath(uri?: string) {
  if (!uri) {
    return undefined;
  }
  const cachedPath = IMAGE_CACHE_MAP.get(uri);
  if (cachedPath) {
    return cachedPath;
  }
  const existingPromise = IMAGE_CACHE_PROMISE_MAP.get(uri);
  if (existingPromise) {
    return existingPromise;
  }
  const promise = Image.getCachePathAsync(uri)
    .then((cachePath) => {
      if (cachePath) {
        setCachedImagePath(uri, cachePath);
      }
      return cachePath ?? undefined;
    })
    .catch(() => undefined)
    .finally(() => {
      IMAGE_CACHE_PROMISE_MAP.delete(uri);
    });
  IMAGE_CACHE_PROMISE_MAP.set(uri, promise);
  return promise;
}

export async function refreshCachedImageRef(
  uri?: string,
  options?: ImageLoadOptions,
  cacheKey = uri,
) {
  if (!uri || !cacheKey) {
    return undefined;
  }
  // The decoded ImageRef cache is iOS-only. On Android expo-image (Glide) cannot
  // safely reuse a decoded SharedRef across views — it crashes with a SIGSEGV in
  // folly::dynamic::destroy() (see patches/expo-image+3.0.10.patch and commit
  // 7ec61c435c), so useImage() never reads this cache back on Android. Decoding
  // here would therefore be wasted work, and worse: it calls Image.loadAsync on a
  // bare local cache path (no file:// scheme) which Glide rejects, and it leaves
  // released/invalidated refs in the shared map that poison later same-URI renders
  // (e.g. Perps prewarm breaking the Swap tab -> white screen). Android keeps fast
  // image loading via Image.prefetch warming Glide's native disk+memory cache.
  if (platformEnv.isNativeAndroid) {
    return undefined;
  }
  const cachedImageRef = getCachedImageRef(cacheKey, uri);
  if (hasExactCachedImageRef(cacheKey, uri) && cachedImageRef) {
    return cachedImageRef;
  }
  const promiseKey = getImageRefEntryKey(cacheKey, uri);
  const existingPromise = IMAGE_REF_CACHE_PROMISE_MAP.get(promiseKey);
  if (existingPromise) {
    return existingPromise;
  }
  const promise = (async () => {
    const cachedPath = await refreshCachedImagePath(uri);
    const source: ImageSource = {
      uri: cachedPath ?? uri,
    };
    const imageRef = await Image.loadAsync(source, options);
    setCachedImageRef(cacheKey, imageRef, uri);
    if (!cachedPath) {
      void refreshCachedImagePath(uri);
    }
    return getCachedImageRef(cacheKey, uri);
  })()
    .catch(() => undefined)
    .finally(() => {
      IMAGE_REF_CACHE_PROMISE_MAP.delete(promiseKey);
    });
  IMAGE_REF_CACHE_PROMISE_MAP.set(promiseKey, promise);
  return promise;
}

export async function refreshCachedImagePaths(uris: string[]) {
  for (let i = 0; i < uris.length; i += IMAGE_CACHE_PRIME_CONCURRENCY) {
    await Promise.allSettled(
      uris
        .slice(i, i + IMAGE_CACHE_PRIME_CONCURRENCY)
        .map((uri) => refreshCachedImagePath(uri)),
    );
  }
}

export async function refreshCachedImageRefs(uris: string[]) {
  for (let i = 0; i < uris.length; i += IMAGE_REF_CACHE_PRIME_CONCURRENCY) {
    await Promise.allSettled(
      uris
        .slice(i, i + IMAGE_REF_CACHE_PRIME_CONCURRENCY)
        .map((uri) => refreshCachedImageRef(uri)),
    );
  }
}

export function getMissingCachedImageUris(uris: string[]) {
  return uris.filter((uri) => !IMAGE_CACHE_MAP.has(uri));
}

export async function primeCachedImagePaths({
  uris,
  timeoutMs,
}: {
  uris: string[];
  timeoutMs?: number;
}) {
  if (!uris.length) {
    return;
  }
  const task = refreshCachedImagePaths(uris);
  if (!timeoutMs || timeoutMs <= 0) {
    void task;
    return;
  }
  try {
    await Promise.race([
      task,
      new Promise<void>((resolve) => {
        setTimeout(resolve, timeoutMs);
      }),
    ]);
  } catch {
    // Cache priming is best-effort and must never block rendering.
  }
}

export async function primeCachedImageRefs({
  uris,
  timeoutMs,
}: {
  uris: string[];
  timeoutMs?: number;
}) {
  if (!uris.length) {
    return;
  }
  const task = refreshCachedImageRefs(uris);
  if (!timeoutMs || timeoutMs <= 0) {
    await task;
    return;
  }
  try {
    await Promise.race([
      task,
      new Promise<void>((resolve) => {
        setTimeout(resolve, timeoutMs);
      }),
    ]);
  } catch {
    // Decoded image priming is best-effort and must never block rendering.
  }
}
