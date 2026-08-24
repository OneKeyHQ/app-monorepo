import { NATIVE_TOKEN_MOCK_ADDRESS } from '../consts/tokenConsts';
import { coldStartCacheStorage } from '../storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

const IDENTITY_IMAGE_URL_CACHE_VERSION = 1;
const IDENTITY_IMAGE_URL_CACHE_MAX_ENTRIES = 768;
const IDENTITY_IMAGE_URL_RELOAD_INTERVAL_MS = 1000;
const IDENTITY_IMAGE_URL_TOUCH_INTERVAL_MS = 60 * 60 * 1000;
const CASE_SENSITIVE_TOKEN_ADDRESS_IMPLS = new Set([
  'sol',
  'stc',
  'tron',
  'aptos',
  'sui',
  'ton',
]);

type IIdentityImageUrlEntry = {
  url: string;
  updatedAt: number;
};

type IIdentityImageUrlStore = {
  version: typeof IDENTITY_IMAGE_URL_CACHE_VERSION;
  entries: Record<string, IIdentityImageUrlEntry>;
};

export type IIdentityImageUrlWrite = {
  identity: string;
  url?: string;
};

const memoryUrls = new Map<string, { cachedAt: number; url: string }>();
let readerStore: IIdentityImageUrlStore | undefined;
let readerLoadedAt = 0;
let writerStore: IIdentityImageUrlStore | undefined;

function encodeIdentitySegment(value: string) {
  return encodeURIComponent(value.trim());
}

function normalizeUrl(url?: unknown) {
  return typeof url === 'string' ? url.trim() : '';
}

function createEmptyStore(): IIdentityImageUrlStore {
  return {
    version: IDENTITY_IMAGE_URL_CACHE_VERSION,
    entries: {},
  };
}

function parseStore(value: unknown): IIdentityImageUrlStore {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (value as Partial<IIdentityImageUrlStore>).version !==
      IDENTITY_IMAGE_URL_CACHE_VERSION
  ) {
    return createEmptyStore();
  }
  const entries = (value as Partial<IIdentityImageUrlStore>).entries;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return createEmptyStore();
  }
  return {
    version: IDENTITY_IMAGE_URL_CACHE_VERSION,
    entries: entries as Record<string, IIdentityImageUrlEntry>,
  };
}

function readStoreFromStorage() {
  try {
    return parseStore(
      coldStartCacheStorage.getObject<IIdentityImageUrlStore>(
        EAppSyncStorageKeys.onekey_identity_image_url_cache,
      ),
    );
  } catch {
    return createEmptyStore();
  }
}

function loadReaderStore({ force = false }: { force?: boolean } = {}) {
  const now = Date.now();
  if (
    force ||
    !readerStore ||
    now < readerLoadedAt ||
    now - readerLoadedAt >= IDENTITY_IMAGE_URL_RELOAD_INTERVAL_MS
  ) {
    readerStore = readStoreFromStorage();
    readerLoadedAt = now;
  }
  return readerStore;
}

function loadWriterStore() {
  writerStore ??= readStoreFromStorage();
  return writerStore;
}

function pruneStore(store: IIdentityImageUrlStore) {
  const keys = Object.keys(store.entries);
  if (keys.length <= IDENTITY_IMAGE_URL_CACHE_MAX_ENTRIES) {
    return;
  }
  const sortedKeys = keys.toSorted(
    (left, right) =>
      (store.entries[left]?.updatedAt ?? 0) -
      (store.entries[right]?.updatedAt ?? 0),
  );
  const removeCount = keys.length - IDENTITY_IMAGE_URL_CACHE_MAX_ENTRIES;
  for (let index = 0; index < removeCount; index += 1) {
    delete store.entries[sortedKeys[index]];
  }
}

function writeStore(store: IIdentityImageUrlStore) {
  try {
    coldStartCacheStorage.setObject(
      EAppSyncStorageKeys.onekey_identity_image_url_cache,
      store,
    );
    readerStore = store;
    readerLoadedAt = Date.now();
  } catch {
    writerStore = undefined;
    readerStore = undefined;
    readerLoadedAt = 0;
    // The URL cache is best-effort and must not fail its owning request.
  }
}

export function buildNetworkImageIdentity(networkId?: string) {
  const normalizedNetworkId = networkId?.trim();
  return normalizedNetworkId
    ? `network:${encodeIdentitySegment(normalizedNetworkId)}`
    : '';
}

export function buildTokenImageIdentity({
  contractAddress,
  isNative,
  networkId,
}: {
  contractAddress?: string;
  isNative?: boolean;
  networkId?: string;
}) {
  const normalizedNetworkId = networkId?.trim();
  if (!normalizedNetworkId) {
    return '';
  }
  const trimmedAddress = contractAddress?.trim();
  const networkImpl = normalizedNetworkId.split('--')[0];
  let normalizedAddress = NATIVE_TOKEN_MOCK_ADDRESS;
  if (!isNative && trimmedAddress) {
    normalizedAddress = CASE_SENSITIVE_TOKEN_ADDRESS_IMPLS.has(networkImpl)
      ? trimmedAddress
      : trimmedAddress.toLowerCase();
  }
  return `token:${encodeIdentitySegment(
    normalizedNetworkId,
  )}:${encodeIdentitySegment(normalizedAddress)}`;
}

export function buildMarketImageIdentity({
  identity,
  locale,
  scope,
}: {
  identity?: string;
  locale?: string;
  scope?: string;
}) {
  const normalizedIdentity = identity?.trim().toLowerCase();
  const normalizedLocale = locale?.trim().toLowerCase();
  const normalizedScope = scope?.trim().toLowerCase();
  if (!normalizedIdentity || !normalizedLocale || !normalizedScope) {
    return '';
  }
  return `market:${encodeIdentitySegment(
    normalizedLocale,
  )}:${encodeIdentitySegment(normalizedScope)}:${encodeIdentitySegment(
    normalizedIdentity,
  )}`;
}

export function rememberIdentityImageUrl({
  identity,
  url,
}: IIdentityImageUrlWrite) {
  const normalizedUrl = normalizeUrl(url);
  if (identity && normalizedUrl) {
    memoryUrls.set(identity, { cachedAt: Date.now(), url: normalizedUrl });
  }
}

export function getIdentityImageUrl(identity?: string) {
  if (!identity) {
    return '';
  }
  const now = Date.now();
  const memoryEntry = memoryUrls.get(identity);
  if (
    memoryEntry &&
    now >= memoryEntry.cachedAt &&
    now - memoryEntry.cachedAt < IDENTITY_IMAGE_URL_RELOAD_INTERVAL_MS
  ) {
    return memoryEntry.url;
  }
  memoryUrls.delete(identity);

  const entry = loadReaderStore().entries[identity];
  const url = normalizeUrl(entry?.url);
  if (url) {
    memoryUrls.set(identity, { cachedAt: now, url });
  }
  return url;
}

export function resolveIdentityImageUrl({
  identity,
  ownerUrl,
}: {
  identity?: string;
  ownerUrl?: string;
}) {
  const normalizedOwnerUrl = normalizeUrl(ownerUrl);
  if (normalizedOwnerUrl) {
    rememberIdentityImageUrl({
      identity: identity ?? '',
      url: normalizedOwnerUrl,
    });
    return normalizedOwnerUrl;
  }
  return getIdentityImageUrl(identity);
}

export function forgetIdentityImageUrl(identity?: string) {
  if (!identity) {
    return;
  }
  memoryUrls.delete(identity);
  if (readerStore) {
    delete readerStore.entries[identity];
  }
  readerLoadedAt = 0;
}

export function persistIdentityImageUrlsFromBackground(
  writes: IIdentityImageUrlWrite[],
) {
  const validWrites = writes.flatMap(({ identity, url }) => {
    const normalizedUrl = normalizeUrl(url);
    return identity && normalizedUrl ? [{ identity, url: normalizedUrl }] : [];
  });
  if (validWrites.length === 0) {
    return;
  }

  const now = Date.now();
  const store = loadWriterStore();
  let changed = false;
  for (const { identity, url } of validWrites) {
    const previous = store.entries[identity];
    if (
      previous?.url === url &&
      now - previous.updatedAt < IDENTITY_IMAGE_URL_TOUCH_INTERVAL_MS
    ) {
      memoryUrls.set(identity, { cachedAt: now, url });
    } else {
      store.entries[identity] = { url, updatedAt: now };
      memoryUrls.set(identity, { cachedAt: now, url });
      changed = true;
    }
  }
  if (!changed) {
    return;
  }
  pruneStore(store);
  writeStore(store);
}

export function replaceIdentityImageUrlFromBackground({
  identity,
  url,
}: IIdentityImageUrlWrite) {
  if (!identity) {
    return;
  }
  const normalizedUrl = normalizeUrl(url);
  const store = loadWriterStore();
  if (normalizedUrl) {
    store.entries[identity] = {
      url: normalizedUrl,
      updatedAt: Date.now(),
    };
    memoryUrls.set(identity, {
      cachedAt: Date.now(),
      url: normalizedUrl,
    });
  } else {
    delete store.entries[identity];
    memoryUrls.delete(identity);
  }
  pruneStore(store);
  writeStore(store);
}

export function resetIdentityImageUrlCacheState() {
  memoryUrls.clear();
  readerStore = undefined;
  readerLoadedAt = 0;
  writerStore = undefined;
}
