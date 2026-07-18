import {
  getMissingCachedImageRefUris,
  primeCachedImagePaths,
  primeCachedImageRefs,
} from '@onekeyhq/components/src/primitives/Image/cache';
import { preloadImages } from '@onekeyhq/components/src/primitives/Image/preload';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { coldStartCacheStorage } from '@onekeyhq/shared/src/storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  getHyperliquidTokenImageUrl,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';

type IColdStartSnapshot = Record<string, unknown>;

type IGlobalColdStartSnapshot = typeof globalThis & {
  __ONEKEY_CTX_ATOM_SNAPSHOT__?: IColdStartSnapshot;
};

type IImagePreloadOptions = {
  limit?: number;
  awaitPreload?: boolean;
  awaitPreloadTimeoutMs?: number;
  decode?: boolean;
  decodeTimeoutMs?: number;
  primeTimeoutMs?: number;
  preload?: boolean;
};

type IStockCriticalImagePreloadOptions = IImagePreloadOptions & {
  maxSelectionAgeMs?: number;
  now?: number;
  requireActiveStock?: boolean;
};

type IColdStartImagePreloadOptions = IImagePreloadOptions & {
  snapshot?: IColdStartSnapshot;
  stockCriticalOptions?: IStockCriticalImagePreloadOptions;
};

type ITokenSelectorImageItem = {
  tokenName?: string;
  spotUniverse?: {
    baseName?: string;
  };
};

const REMOTE_IMAGE_URI_RE = /^https?:\/\//i;
const COLD_START_IMAGE_PRELOAD_LIMIT = 96;
const WALLET_TOKEN_OWNER_LIMIT = 2;
const WALLET_TOKEN_LIMIT_PER_OWNER = 24;
const SWAP_POSITION_OWNER_LIMIT = 3;
const SWAP_POSITION_TOKEN_LIMIT = 8;
const PERPS_POSITION_LIMIT = 16;
const PERPS_OPEN_ORDER_LIMIT = 16;
const PERPS_ALIAS_LOGO_LIMIT = 24;
const PERPS_TOKEN_SELECTOR_LOGO_LIMIT = 72;
const PERPS_TOKEN_SELECTOR_CRITICAL_LOGO_LIMIT = 24;
const MAIN_SWAP_STORE_SCOPE_KEY = 'store:swap';
const stockDisplayStoreCache = new WeakMap<
  IColdStartSnapshot,
  { value: unknown }
>();
const PERPS_TOKEN_SELECTOR_PRIORITY_COINS = [
  'BTC',
  'ETH',
  'HYPE',
  'ZEC',
  'XYZ100',
  'SP500',
  'SOL',
  'CL',
  'MU',
  'NEAR',
  'XRP',
  'DOGE',
  'BNB',
  'SUI',
  'ENA',
  'LINK',
  'AVAX',
  'LTC',
  'PAXG',
  'TSLA',
  'COIN',
  'NVDA',
] as const;

const SWAP_TOKEN_CACHE_KEYS = [
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
] as const;

function getColdStartSnapshot() {
  return (globalThis as IGlobalColdStartSnapshot).__ONEKEY_CTX_ATOM_SNAPSHOT__;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addImageUri(uris: Set<string>, uri?: unknown) {
  if (typeof uri === 'string' && REMOTE_IMAGE_URI_RE.test(uri)) {
    uris.add(uri);
  }
}

function addTokenLikeImageUris(uris: Set<string>, token?: unknown) {
  if (!isRecord(token)) {
    return;
  }
  addImageUri(uris, token.logoURI);
  addImageUri(uris, token.networkLogoURI);
  if (typeof token.networkId === 'string') {
    addImageUri(
      uris,
      networkUtils.getLocalNetworkInfo(token.networkId)?.logoURI,
    );
  }
}

function addPerpsCoinLogoUri(uris: Set<string>, coin?: unknown) {
  if (typeof coin !== 'string' || !coin) {
    return;
  }
  addImageUri(
    uris,
    getHyperliquidTokenImageUrl(parseDexCoin(coin).displayName),
  );
}

function addTokenSelectorItemLogoUri(
  uris: Set<string>,
  item: ITokenSelectorImageItem,
) {
  if (item.spotUniverse?.baseName) {
    addPerpsCoinLogoUri(uris, item.spotUniverse.baseName);
  } else {
    addPerpsCoinLogoUri(uris, item.tokenName);
  }
}

function getSnapshotValuesByColdStartKey({
  snapshot,
  coldStartCacheKey,
}: {
  snapshot: IColdStartSnapshot;
  coldStartCacheKey: string;
}) {
  return Object.entries(snapshot)
    .filter(([key]) => key.endsWith(`::${coldStartCacheKey}`))
    .map(([, value]) => value);
}

function getMainSwapSnapshotValue({
  snapshot,
  coldStartCacheKey,
}: {
  snapshot: IColdStartSnapshot;
  coldStartCacheKey: string;
}) {
  return snapshot[`${MAIN_SWAP_STORE_SCOPE_KEY}::${coldStartCacheKey}`];
}

function isMainStockColdStartContextActive(snapshot: IColdStartSnapshot) {
  const mainSwapContext = getMainSwapSnapshotValue({
    snapshot,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
  });
  const visibleSwapType = getMainSwapSnapshotValue({
    snapshot,
    coldStartCacheKey: CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
  });
  return Boolean(
    isRecord(mainSwapContext) &&
    mainSwapContext.swapType === 'stock' &&
    visibleSwapType === 'stock',
  );
}

function getStockDisplayStoreOnce(snapshot: IColdStartSnapshot) {
  const cached = stockDisplayStoreCache.get(snapshot);
  if (cached) {
    return cached.value;
  }
  let value: unknown;
  try {
    value = coldStartCacheStorage.getObject<unknown>(
      EAppSyncStorageKeys.onekey_swap_stock_display_snapshot,
    );
  } catch {
    // Dedicated Stock display restoration is optional during startup.
  }
  stockDisplayStoreCache.set(snapshot, { value });
  return value;
}

function getUpdatedAt(value: unknown) {
  return isRecord(value) && typeof value.updatedAt === 'number'
    ? value.updatedAt
    : Number.MIN_SAFE_INTEGER;
}

function collectWalletTokenImageUris({
  uris,
  snapshot,
}: {
  uris: Set<string>;
  snapshot: IColdStartSnapshot;
}) {
  // TokenList cells §7: the cold-start persisted token-list role moved from the
  // OLD `renderedTokenListCacheAtom` (byOwner[].tokens) to the slim bundle
  // (`tokenListSlimColdCache`, single-owner). Prewarm logos from the slim
  // bundle's `compactMeta` values instead of the retired byOwner shape.
  for (const value of getSnapshotValuesByColdStartKey({
    snapshot,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.tokenListSlimColdCacheAtom,
  })) {
    if (isRecord(value) && isRecord(value.compactMeta)) {
      const metas = Object.values(value.compactMeta)
        .filter(isRecord)
        .slice(0, WALLET_TOKEN_OWNER_LIMIT * WALLET_TOKEN_LIMIT_PER_OWNER);
      for (const tokenMeta of metas) {
        addTokenLikeImageUris(uris, tokenMeta);
      }
    }
  }
}

function collectSwapImageUris({
  uris,
  snapshot,
}: {
  uris: Set<string>;
  snapshot: IColdStartSnapshot;
}) {
  for (const cacheKey of SWAP_TOKEN_CACHE_KEYS) {
    for (const value of getSnapshotValuesByColdStartKey({
      snapshot,
      coldStartCacheKey: cacheKey,
    })) {
      addTokenLikeImageUris(uris, value);
    }
  }

  for (const value of getSnapshotValuesByColdStartKey({
    snapshot,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapProPositionsCacheAtom,
  })) {
    if (isRecord(value) && isRecord(value.byOwner)) {
      const entries = Object.values(value.byOwner)
        .filter(isRecord)
        .toSorted((a, b) => getUpdatedAt(b) - getUpdatedAt(a))
        .slice(0, SWAP_POSITION_OWNER_LIMIT);
      for (const entry of entries) {
        const tokens = Array.isArray(entry.tokens) ? entry.tokens : [];
        for (const token of tokens.slice(0, SWAP_POSITION_TOKEN_LIMIT)) {
          addTokenLikeImageUris(uris, token);
        }
      }
    }
  }
}

export function getStockColdStartImageUrisFromSnapshot(
  snapshot = getColdStartSnapshot(),
  stockDisplayStore?: unknown,
  {
    maxSelectionAgeMs,
    now = Date.now(),
    requireActiveStock = false,
  }: Pick<
    IStockCriticalImagePreloadOptions,
    'maxSelectionAgeMs' | 'now' | 'requireActiveStock'
  > = {},
) {
  const uris = new Set<string>();
  if (!snapshot) {
    return [];
  }

  const mainSwapContext = getMainSwapSnapshotValue({
    snapshot,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
  });
  if (requireActiveStock && !isMainStockColdStartContextActive(snapshot)) {
    return [];
  }
  const mainAccountKey =
    isRecord(mainSwapContext) && typeof mainSwapContext.accountKey === 'string'
      ? mainSwapContext.accountKey
      : undefined;
  const stockEntry =
    mainAccountKey &&
    isRecord(stockDisplayStore) &&
    stockDisplayStore.version === 1 &&
    isRecord(stockDisplayStore.entries)
      ? stockDisplayStore.entries[encodeURIComponent(mainAccountKey)]
      : undefined;
  const stockSnapshot = isRecord(stockEntry) ? stockEntry.snapshot : undefined;
  const stockIdentity = isRecord(stockSnapshot)
    ? stockSnapshot.identity
    : undefined;
  const stockSelection = isRecord(stockSnapshot)
    ? stockSnapshot.selection
    : undefined;
  const selectionUpdatedAt = isRecord(stockSelection)
    ? stockSelection.updatedAt
    : undefined;
  const isFreshSelection =
    maxSelectionAgeMs === undefined ||
    (typeof selectionUpdatedAt === 'number' &&
      Number.isFinite(selectionUpdatedAt) &&
      selectionUpdatedAt <= now &&
      now - selectionUpdatedAt <= maxSelectionAgeMs);
  if (
    mainAccountKey &&
    isRecord(stockIdentity) &&
    stockIdentity.accountKey === mainAccountKey &&
    isRecord(stockSelection) &&
    isRecord(stockSelection.identity) &&
    stockSelection.identity.accountKey === mainAccountKey &&
    isFreshSelection
  ) {
    addTokenLikeImageUris(uris, stockSelection.stockToken);
    addTokenLikeImageUris(uris, stockSelection.payToken);
  }

  return [...uris];
}

function collectPerpsInstrumentImageUris({
  uris,
  instrument,
}: {
  uris: Set<string>;
  instrument: unknown;
}) {
  if (!isRecord(instrument)) {
    return;
  }
  if (
    isRecord(instrument.universe) &&
    typeof instrument.universe.baseName === 'string'
  ) {
    addPerpsCoinLogoUri(uris, instrument.universe.baseName);
  }
  addPerpsCoinLogoUri(uris, instrument.coin);
}

function collectPerpsImageUris({
  uris,
  snapshot,
}: {
  uris: Set<string>;
  snapshot: IColdStartSnapshot;
}) {
  for (const value of getSnapshotValuesByColdStartKey({
    snapshot,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveTradeInstrumentAtom,
  })) {
    collectPerpsInstrumentImageUris({ uris, instrument: value });
  }

  for (const value of getSnapshotValuesByColdStartKey({
    snapshot,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActivePositionAtom,
  })) {
    if (isRecord(value) && Array.isArray(value.activePositions)) {
      for (const position of value.activePositions.slice(
        0,
        PERPS_POSITION_LIMIT,
      )) {
        if (isRecord(position) && isRecord(position.position)) {
          addPerpsCoinLogoUri(uris, position.position.coin);
        }
      }
    }
  }

  for (const value of getSnapshotValuesByColdStartKey({
    snapshot,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveOpenOrdersAtom,
  })) {
    if (isRecord(value) && Array.isArray(value.openOrders)) {
      for (const order of value.openOrders.slice(0, PERPS_OPEN_ORDER_LIMIT)) {
        if (isRecord(order)) {
          addPerpsCoinLogoUri(uris, order.coin);
        }
      }
    }
  }

  for (const value of getSnapshotValuesByColdStartKey({
    snapshot,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveAssetCtxColdCacheAtom,
  })) {
    if (isRecord(value)) {
      for (const coin of Object.keys(value).slice(0, PERPS_ALIAS_LOGO_LIMIT)) {
        addPerpsCoinLogoUri(uris, coin);
      }
    }
  }

  for (const value of getSnapshotValuesByColdStartKey({
    snapshot,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsTokenSearchAliasesAtom,
  })) {
    if (isRecord(value)) {
      for (const coin of Object.keys(value).slice(0, PERPS_ALIAS_LOGO_LIMIT)) {
        addPerpsCoinLogoUri(uris, coin);
      }
    }
  }
}

export function getColdStartImageUrisFromSnapshot(
  snapshot = getColdStartSnapshot(),
  limit = COLD_START_IMAGE_PRELOAD_LIMIT,
) {
  const uris = new Set<string>();
  if (!snapshot) {
    return [];
  }

  collectWalletTokenImageUris({ uris, snapshot });
  collectSwapImageUris({ uris, snapshot });
  collectPerpsImageUris({ uris, snapshot });

  return [...uris].slice(0, limit);
}

export function getPerpsTokenSelectorImageUrisFromItems({
  items,
  limit = PERPS_TOKEN_SELECTOR_LOGO_LIMIT,
}: {
  items: ITokenSelectorImageItem[];
  limit?: number;
}) {
  const uris = new Set<string>();
  const criticalItems = items.slice(
    0,
    PERPS_TOKEN_SELECTOR_CRITICAL_LOGO_LIMIT,
  );
  for (const item of criticalItems) {
    addTokenSelectorItemLogoUri(uris, item);
  }
  for (const coin of PERPS_TOKEN_SELECTOR_PRIORITY_COINS) {
    addPerpsCoinLogoUri(uris, coin);
  }
  for (const item of items.slice(PERPS_TOKEN_SELECTOR_CRITICAL_LOGO_LIMIT)) {
    addTokenSelectorItemLogoUri(uris, item);
    if (uris.size >= limit) {
      break;
    }
  }
  return [...uris].slice(0, limit);
}

export async function prewarmImageUris(
  imageUris: string[],
  {
    limit = COLD_START_IMAGE_PRELOAD_LIMIT,
    awaitPreload = false,
    awaitPreloadTimeoutMs,
    decode = false,
    decodeTimeoutMs,
    primeTimeoutMs,
    preload = true,
  }: IImagePreloadOptions = {},
) {
  const uris = [...new Set(imageUris)].slice(0, limit);
  if (!uris.length) {
    return 0;
  }
  await primeCachedImagePaths({ uris, timeoutMs: primeTimeoutMs });
  const tasks: Array<Promise<unknown>> = [];
  // The decoded ImageRef cache is iOS-only (see Image/cache.ts). On Android,
  // fall back to Image.prefetch so Glide's native cache is still warmed for
  // decode-only callers (e.g. Perps token-selector critical logos that pass
  // preload:false), without decoding unconsumed — and crash-prone — SharedRefs.
  const shouldPreload = preload || (platformEnv.isNativeAndroid && decode);
  const shouldDecode = decode && !platformEnv.isNativeAndroid;
  if (shouldPreload) {
    tasks.push(preloadImages(uris.map((uri) => ({ uri }))));
  }
  if (shouldDecode) {
    tasks.push(primeCachedImageRefs({ uris, timeoutMs: decodeTimeoutMs }));
  }
  if (awaitPreload) {
    const settleTask = Promise.allSettled(tasks);
    if (awaitPreloadTimeoutMs && awaitPreloadTimeoutMs > 0) {
      await new Promise<void>((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          resolve();
        }, awaitPreloadTimeoutMs);
        void settleTask.then(() => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve();
        });
      });
    } else {
      await settleTask;
    }
  } else {
    tasks.forEach((task) => {
      void task.catch(() => undefined);
    });
  }
  return uris.length;
}

export async function prewarmColdStartImagesFromSnapshot(
  options: IColdStartImagePreloadOptions = {},
) {
  const {
    snapshot: suppliedSnapshot,
    stockCriticalOptions,
    ...imageOptions
  } = options;
  const { maxSelectionAgeMs, now, requireActiveStock, ...stockImageOptions } =
    stockCriticalOptions ?? {};
  const snapshot = suppliedSnapshot ?? getColdStartSnapshot();
  const stockDisplayStore =
    snapshot &&
    stockCriticalOptions &&
    (!requireActiveStock || isMainStockColdStartContextActive(snapshot))
      ? getStockDisplayStoreOnce(snapshot)
      : undefined;

  const stockImageUris = stockCriticalOptions
    ? getStockColdStartImageUrisFromSnapshot(snapshot, stockDisplayStore, {
        maxSelectionAgeMs,
        now,
        requireActiveStock,
      })
    : [];
  const criticalStockImageUris =
    stockImageOptions.decode && platformEnv.isNativeIOS
      ? getMissingCachedImageRefUris(stockImageUris)
      : stockImageUris;
  const [, globalPrewarmCount] = await Promise.all([
    prewarmImageUris(criticalStockImageUris, {
      ...imageOptions,
      ...stockImageOptions,
      // The current Stock pair is a separate critical budget. It must not be
      // evicted when the x-compatible wallet-first global list reaches 96 URIs.
      limit: criticalStockImageUris.length,
    }),
    prewarmImageUris(
      getColdStartImageUrisFromSnapshot(snapshot, imageOptions.limit),
      imageOptions,
    ),
  ]);
  return globalPrewarmCount;
}

export function prewarmPerpsTokenSelectorImages(
  items: ITokenSelectorImageItem[],
) {
  const uris = getPerpsTokenSelectorImageUrisFromItems({ items });
  const criticalUris = uris.slice(0, PERPS_TOKEN_SELECTOR_CRITICAL_LOGO_LIMIT);
  const remainingUris = uris.slice(PERPS_TOKEN_SELECTOR_CRITICAL_LOGO_LIMIT);
  if (remainingUris.length) {
    void prewarmImageUris(remainingUris, {
      decode: true,
      limit: remainingUris.length,
      preload: true,
      primeTimeoutMs: 250,
    });
  }
  return prewarmImageUris(criticalUris, {
    awaitPreload: true,
    decode: true,
    decodeTimeoutMs: 1500,
    limit: PERPS_TOKEN_SELECTOR_LOGO_LIMIT,
    preload: false,
    primeTimeoutMs: 250,
  });
}
