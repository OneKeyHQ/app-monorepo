import { preloadImages } from '@onekeyhq/components/src/primitives/Image/preload';
import { s } from '@onekeyhq/components/src/utils/scale';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { getHyperliquidTokenImageUris } from '@onekeyhq/shared/src/utils/perpsUtils';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  type ITokenSize,
  getTokenImageResizeWidth,
} from '../components/Token/tokenSize';

type IColdStartSnapshot = Record<string, unknown>;

type IGlobalColdStartSnapshot = typeof globalThis & {
  __ONEKEY_CTX_ATOM_SNAPSHOT__?: IColdStartSnapshot;
};

type IImagePreloadOptions = {
  limit?: number;
  awaitPreload?: boolean;
  pixelRatio?: number;
  resizeWidth?: number;
};

type IImagePreloadItem = {
  uri: string;
  resizeWidth?: number;
};

type IImagePreloadInput = string | IImagePreloadItem;

type IPerpsTokenSelectorImagePreloadOptions = {
  tokenSizes?: readonly ITokenSize[];
};

type ITokenSelectorImageItem = {
  tokenName?: string;
  spotUniverse?: {
    baseName?: string;
  };
};

const REMOTE_IMAGE_URI_RE = /^https?:\/\//i;
const COLD_START_IMAGE_PRELOAD_LIMIT = 96;
// Logical size of the image inside a home wallet banner card. WalletBanner
// renders with this exact size, so the cold-start prewarm below produces the
// same resize URL + decode thumbnail as the first paint (cache-key match).
export const WALLET_BANNER_IMAGE_SIZE = 56;
const WALLET_BANNER_IMAGE_LIMIT = 8;
// Logical size of the network avatar in the home header trigger (`$6`).
// NetworkAvatar renders at this size, so the prewarm resolves to the same
// resize URL + decode thumbnail as the first paint.
export const HEADER_NETWORK_LOGO_SIZE = s(24);
const HEADER_NETWORK_LOGO_LIMIT = 6;
// Cold-start scope key of the home account-selector store (see
// jotaiContextStore.buildJotaiContextStoreId: `store:accountSelector@<scene>`),
// the same key SplashProvider / HomeOverviewContainer read.
const HOME_ACCOUNT_SELECTOR_COLD_START_SCOPE_KEY = `store:accountSelector@${EAccountSelectorSceneName.home}`;
const HOME_ACCOUNT_SELECTOR_NUM = '0';
// AllNetworksManagerTrigger shows at most this many network avatars.
const HEADER_ALL_NETWORKS_AVATAR_LIMIT = 2;
const WALLET_TOKEN_OWNER_LIMIT = 2;
const WALLET_TOKEN_LIMIT_PER_OWNER = 24;
const SWAP_POSITION_OWNER_LIMIT = 3;
const SWAP_POSITION_TOKEN_LIMIT = 8;
const PERPS_POSITION_LIMIT = 16;
const PERPS_OPEN_ORDER_LIMIT = 16;
const PERPS_ALIAS_LOGO_LIMIT = 24;
const PERPS_TOKEN_SELECTOR_LOGO_LIMIT = 72;
const PERPS_TOKEN_SELECTOR_CRITICAL_LOGO_LIMIT = 24;
const COLD_START_IMAGE_PRELOAD_RESIZE_WIDTH = s(32);
const PERPS_TOKEN_SELECTOR_NATIVE_PRELOAD_TOKEN_SIZES = ['lg'] as const;
const PERPS_TOKEN_SELECTOR_DESKTOP_PRELOAD_TOKEN_SIZES = ['sm', 'md'] as const;
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

function getImagePreloadItem(input: IImagePreloadInput): IImagePreloadItem {
  return typeof input === 'string' ? { uri: input } : input;
}

function getPerpsTokenSelectorPreloadSizes(
  tokenSizes?: readonly ITokenSize[],
): readonly ITokenSize[] {
  if (tokenSizes?.length) {
    return tokenSizes;
  }
  return platformEnv.isNative
    ? PERPS_TOKEN_SELECTOR_NATIVE_PRELOAD_TOKEN_SIZES
    : PERPS_TOKEN_SELECTOR_DESKTOP_PRELOAD_TOKEN_SIZES;
}

function buildPerpsTokenSelectorImagePreloadItems({
  uris,
  tokenSizes,
}: {
  uris: string[];
  tokenSizes: readonly ITokenSize[];
}): IImagePreloadItem[] {
  const resizeWidths = [
    ...new Set(tokenSizes.map((size) => getTokenImageResizeWidth(size))),
  ];
  return uris.flatMap((uri) =>
    resizeWidths.map((resizeWidth) => ({ uri, resizeWidth })),
  );
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
  // Warm both sources, otherwise the prefixed file — the one actually rendered
  // — is never prefetched.
  getHyperliquidTokenImageUris(coin).forEach((uri) => addImageUri(uris, uri));
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

function getUpdatedAt(value: unknown) {
  return isRecord(value) && typeof value.updatedAt === 'number'
    ? value.updatedAt
    : Number.MIN_SAFE_INTEGER;
}

// Wallet banner cards render their text from the cold-start snapshot on the
// first frame; without a warm image cache the 56pt image shows a skeleton on
// every launch (OK-61505). Prewarm them at the banner size, ahead of the
// token logos, so the first paint hits the memory cache.
function collectWalletBannerImageItems({
  items,
  snapshot,
}: {
  items: IImagePreloadItem[];
  snapshot: IColdStartSnapshot;
}) {
  const seen = new Set<string>();
  for (const value of getSnapshotValuesByColdStartKey({
    snapshot,
    coldStartCacheKey: CONTEXT_ATOM_COLD_START_CACHE_KEYS.walletTopBannersAtom,
  })) {
    const banners =
      isRecord(value) && Array.isArray(value.banners) ? value.banners : [];
    for (const banner of banners) {
      if (seen.size >= WALLET_BANNER_IMAGE_LIMIT) {
        return;
      }
      const uri = isRecord(banner) ? banner.src : undefined;
      if (
        typeof uri === 'string' &&
        REMOTE_IMAGE_URI_RE.test(uri) &&
        !seen.has(uri)
      ) {
        seen.add(uri);
        items.push({ uri, resizeWidth: WALLET_BANNER_IMAGE_SIZE });
      }
    }
  }
}

function addPreloadItem({
  items,
  seen,
  uri,
  resizeWidth,
}: {
  items: IImagePreloadItem[];
  seen: Set<string>;
  uri: unknown;
  resizeWidth: number;
}) {
  if (
    typeof uri === 'string' &&
    REMOTE_IMAGE_URI_RE.test(uri) &&
    !seen.has(uri)
  ) {
    seen.add(uri);
    items.push({ uri, resizeWidth });
  }
}

function getSnapshotString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}

function collectHeaderNetworkImageItemsFromActiveAccount({
  activeAccount,
  add,
}: {
  activeAccount: unknown;
  add: (uri: unknown) => void;
}) {
  if (!isRecord(activeAccount) || !isRecord(activeAccount.network)) {
    return;
  }
  const { network, wallet, indexedAccount } = activeAccount;
  const networkId = getSnapshotString(network.id);
  if (!networkId) {
    return;
  }
  if (!networkUtils.isAllNetwork({ networkId })) {
    // NetworkAvatar resolves the preset logo synchronously before the bg
    // network lands, so warm that URL first.
    add(networkUtils.getLocalNetworkInfo(networkId)?.logoURI);
    add(network.logoURI);
    return;
  }
  // Mirrors AllNetworksManagerTrigger: others wallets skip the compat query
  // and render the static All Networks icon instead.
  const walletId = isRecord(wallet) ? getSnapshotString(wallet.id) : undefined;
  if (!walletId || accountUtils.isOthersWallet({ walletId })) {
    return;
  }
  const compat = swrCacheUtils.getWithTimestamp<{
    compatibleNetworks?: unknown;
  }>(
    swrKeys.allNetworksCompatible({
      walletId,
      networkId,
      filterNetworksWithoutAccount: true,
      indexedAccountId: isRecord(indexedAccount)
        ? getSnapshotString(indexedAccount.id)
        : undefined,
      withNetworksInfo: false,
      enabledNetworkIdsKey: '',
    }),
  )?.data;
  const compatNetworks =
    isRecord(compat) && Array.isArray(compat.compatibleNetworks)
      ? compat.compatibleNetworks
      : [];
  for (const compatNetwork of compatNetworks.slice(
    0,
    HEADER_ALL_NETWORKS_AVATAR_LIMIT,
  )) {
    if (isRecord(compatNetwork)) {
      add(compatNetwork.logoURI);
    }
  }
}

// Home header network trigger (OK-61505). Single-network mode paints the
// active network logo, All Networks mode paints the first compat network
// logos from the trigger's own swr snapshot. Both are remote CDN images
// behind a blank placeholder, so a cold memory cache leaves a hole next to
// the account name on the first frame.
function collectHeaderNetworkImageItems({
  items,
  snapshot,
}: {
  items: IImagePreloadItem[];
  snapshot: IColdStartSnapshot;
}) {
  const seen = new Set<string>();
  const add = (uri: unknown) => {
    if (seen.size < HEADER_NETWORK_LOGO_LIMIT) {
      addPreloadItem({
        items,
        seen,
        uri,
        resizeWidth: HEADER_NETWORK_LOGO_SIZE,
      });
    }
  };
  // Only the home scene's slot 0 paints in the header on the first frame;
  // other account-selector scenes (swap, perps, ...) also persist this atom
  // but must not spend the critical prewarm budget.
  const value =
    snapshot[
      `${HOME_ACCOUNT_SELECTOR_COLD_START_SCOPE_KEY}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.activeAccountsAtom}`
    ];
  if (!isRecord(value)) {
    return;
  }
  collectHeaderNetworkImageItemsFromActiveAccount({
    activeAccount: value[HOME_ACCOUNT_SELECTOR_NUM],
    add,
  });
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

// Images the home page paints on its very first frame: banner cards and the
// header network trigger. Everything else in the snapshot is below the fold
// or behind a tab and can finish loading after render.
export function getColdStartCriticalImageItemsFromSnapshot(
  snapshot = getColdStartSnapshot(),
): IImagePreloadItem[] {
  const items: IImagePreloadItem[] = [];
  if (!snapshot) {
    return items;
  }
  collectWalletBannerImageItems({ items, snapshot });
  collectHeaderNetworkImageItems({ items, snapshot });
  return items;
}

function collectColdStartImages(
  snapshot: IColdStartSnapshot | undefined,
  limit: number,
) {
  const uris = new Set<string>();
  if (!snapshot) {
    return { criticalItems: [], remainingUris: [] };
  }
  const criticalItems = getColdStartCriticalImageItemsFromSnapshot(snapshot);
  collectWalletTokenImageUris({ uris, snapshot });
  collectSwapImageUris({ uris, snapshot });
  collectPerpsImageUris({ uris, snapshot });
  return {
    criticalItems: criticalItems.slice(0, limit),
    remainingUris: [...uris].slice(
      0,
      Math.max(limit - criticalItems.length, 0),
    ),
  };
}

export function getColdStartImageUrisFromSnapshot(
  snapshot = getColdStartSnapshot(),
  limit = COLD_START_IMAGE_PRELOAD_LIMIT,
): IImagePreloadInput[] {
  const { criticalItems, remainingUris } = collectColdStartImages(
    snapshot,
    limit,
  );
  return [...criticalItems, ...remainingUris];
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
  imageUris: IImagePreloadInput[],
  {
    limit = COLD_START_IMAGE_PRELOAD_LIMIT,
    awaitPreload = false,
    pixelRatio,
    resizeWidth = COLD_START_IMAGE_PRELOAD_RESIZE_WIDTH,
  }: IImagePreloadOptions = {},
) {
  const sources = [
    ...new Map(
      imageUris
        .slice(0, limit)
        .map(getImagePreloadItem)
        .filter((item) => Boolean(item.uri))
        .map((item) => {
          const source = {
            uri: item.uri,
            resizeWidth: item.resizeWidth ?? resizeWidth,
            pixelRatio,
          };
          return [`${source.uri}|${source.resizeWidth}`, source] as const;
        }),
    ).values(),
  ];
  if (!sources.length) {
    return 0;
  }
  const task = preloadImages(sources);
  if (awaitPreload) {
    await task.catch(() => false);
  } else {
    void task.catch(() => undefined);
  }
  return sources.length;
}

export async function prewarmColdStartImagesFromSnapshot(
  options: IImagePreloadOptions & {
    snapshot?: IColdStartSnapshot;
  } = {},
) {
  return prewarmImageUris(
    getColdStartImageUrisFromSnapshot(options.snapshot, options.limit),
    options,
  );
}

let coldStartCriticalImagesTask: Promise<number> | undefined;

// Two batches: the first-paint critical subset is awaitable through
// `waitForColdStartCriticalImages`, the rest is fire-and-forget. Native calls
// this from the storage bootstrap and awaits the critical batch (bounded)
// before mounting the app, so the home header/banner images hit the memory
// cache on their first layout instead of flashing a skeleton (OK-61505).
export function startColdStartImagePrewarm({
  snapshot = getColdStartSnapshot(),
  limit = COLD_START_IMAGE_PRELOAD_LIMIT,
}: {
  snapshot?: IColdStartSnapshot;
  limit?: number;
} = {}): Promise<number> {
  const { criticalItems, remainingUris } = collectColdStartImages(
    snapshot,
    limit,
  );
  const critical = prewarmImageUris(criticalItems, {
    awaitPreload: true,
    limit: criticalItems.length,
  }).catch(() => 0);
  if (remainingUris.length) {
    void prewarmImageUris(remainingUris, { limit: remainingUris.length });
  }
  coldStartCriticalImagesTask = critical;
  return critical;
}

export function waitForColdStartCriticalImages(): Promise<number> {
  return coldStartCriticalImagesTask ?? startColdStartImagePrewarm();
}

export function prewarmPerpsTokenSelectorImages(
  items: ITokenSelectorImageItem[],
  options: IPerpsTokenSelectorImagePreloadOptions = {},
) {
  const uris = getPerpsTokenSelectorImageUrisFromItems({ items });
  const criticalUris = uris.slice(0, PERPS_TOKEN_SELECTOR_CRITICAL_LOGO_LIMIT);
  const remainingUris = uris.slice(PERPS_TOKEN_SELECTOR_CRITICAL_LOGO_LIMIT);
  const tokenSizes = getPerpsTokenSelectorPreloadSizes(options.tokenSizes);
  const criticalItems = buildPerpsTokenSelectorImagePreloadItems({
    uris: criticalUris,
    tokenSizes,
  });
  const remainingItems = buildPerpsTokenSelectorImagePreloadItems({
    uris: remainingUris,
    tokenSizes,
  });
  if (remainingItems.length) {
    void prewarmImageUris(remainingItems, {
      limit: remainingItems.length,
    });
  }
  return prewarmImageUris(criticalItems, {
    awaitPreload: true,
    limit: criticalItems.length,
  });
}
