import { Image } from 'expo-image';

import type { ImageLoadOptions, ImageRef, ImageSource } from 'expo-image';

const IMAGE_CACHE_MAP = new Map<string, string>();
const IMAGE_CACHE_PROMISE_MAP = new Map<string, Promise<string | undefined>>();
type IImageRefCacheEntry = {
  imageRef: ImageRef;
  refCount: number;
  lastUsedAt: number;
  invalidated?: boolean;
};

const IMAGE_REF_CACHE_MAP = new Map<string, IImageRefCacheEntry>();
const IMAGE_REF_CACHE_PROMISE_MAP = new Map<
  string,
  Promise<ImageRef | undefined>
>();
const IMAGE_CACHE_PRIME_CONCURRENCY = 4;
const IMAGE_REF_CACHE_PRIME_CONCURRENCY = 3;
const IMAGE_REF_CACHE_MAX_SIZE = 128;

export function getCachedImagePath(uri?: string) {
  return uri ? IMAGE_CACHE_MAP.get(uri) : undefined;
}

export function getCachedImageRef(uri?: string) {
  if (!uri) {
    return undefined;
  }
  const entry = IMAGE_REF_CACHE_MAP.get(uri);
  if (!entry || entry.invalidated) {
    return undefined;
  }
  entry.lastUsedAt = Date.now();
  return entry.imageRef;
}

function releaseImageRef(imageRef: ImageRef) {
  try {
    imageRef.release();
  } catch {
    // ImageRef may already be released by native cleanup.
  }
}

function deleteImageRefCacheEntry(uri: string, entry: IImageRefCacheEntry) {
  IMAGE_REF_CACHE_MAP.delete(uri);
  releaseImageRef(entry.imageRef);
}

function trimImageRefCache() {
  if (IMAGE_REF_CACHE_MAP.size <= IMAGE_REF_CACHE_MAX_SIZE) {
    return;
  }
  const releasableEntries = Array.from(IMAGE_REF_CACHE_MAP.entries())
    .filter(([, entry]) => entry.refCount <= 0)
    .toSorted(([, a], [, b]) => a.lastUsedAt - b.lastUsedAt);

  for (const [uri, entry] of releasableEntries) {
    if (IMAGE_REF_CACHE_MAP.size <= IMAGE_REF_CACHE_MAX_SIZE) {
      break;
    }
    deleteImageRefCacheEntry(uri, entry);
  }
}

export function retainCachedImageRef(uri?: string) {
  if (!uri) {
    return undefined;
  }
  const entry = IMAGE_REF_CACHE_MAP.get(uri);
  if (!entry || entry.invalidated) {
    return undefined;
  }
  entry.refCount += 1;
  entry.lastUsedAt = Date.now();
  return entry.imageRef;
}

export function releaseCachedImageRef(uri?: string) {
  if (!uri) {
    return;
  }
  const entry = IMAGE_REF_CACHE_MAP.get(uri);
  if (!entry) {
    return;
  }
  entry.refCount = Math.max(0, entry.refCount - 1);
  entry.lastUsedAt = Date.now();
  if (entry.invalidated && entry.refCount <= 0) {
    deleteImageRefCacheEntry(uri, entry);
    return;
  }
  trimImageRefCache();
}

export function setCachedImagePath(uri: string, cachePath: string) {
  IMAGE_CACHE_MAP.set(uri, cachePath);
}

export function setCachedImageRef(uri: string, imageRef: ImageRef) {
  const existingEntry = IMAGE_REF_CACHE_MAP.get(uri);
  if (existingEntry) {
    if (existingEntry.invalidated && existingEntry.refCount <= 0) {
      deleteImageRefCacheEntry(uri, existingEntry);
    } else {
      existingEntry.lastUsedAt = Date.now();
      releaseImageRef(imageRef);
      return;
    }
  }
  IMAGE_REF_CACHE_MAP.set(uri, {
    imageRef,
    refCount: 0,
    lastUsedAt: Date.now(),
  });
  trimImageRefCache();
}

export function deleteCachedImagePath(uri?: string) {
  if (uri) {
    IMAGE_CACHE_MAP.delete(uri);
    const entry = IMAGE_REF_CACHE_MAP.get(uri);
    if (entry) {
      if (entry.refCount > 0) {
        entry.invalidated = true;
        entry.lastUsedAt = Date.now();
      } else {
        deleteImageRefCacheEntry(uri, entry);
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
) {
  if (!uri) {
    return undefined;
  }
  const cachedImageRef = getCachedImageRef(uri);
  if (cachedImageRef) {
    return cachedImageRef;
  }
  const existingPromise = IMAGE_REF_CACHE_PROMISE_MAP.get(uri);
  if (existingPromise) {
    return existingPromise;
  }
  const promise = (async () => {
    const cachedPath = await refreshCachedImagePath(uri);
    const source: ImageSource = {
      uri: cachedPath ?? uri,
    };
    const imageRef = await Image.loadAsync(source, options);
    setCachedImageRef(uri, imageRef);
    if (!cachedPath) {
      void refreshCachedImagePath(uri);
    }
    return getCachedImageRef(uri);
  })()
    .catch(() => undefined)
    .finally(() => {
      IMAGE_REF_CACHE_PROMISE_MAP.delete(uri);
    });
  IMAGE_REF_CACHE_PROMISE_MAP.set(uri, promise);
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
