import BigNumber from 'bignumber.js';

import { preloadImage } from '@onekeyhq/components/src/primitives/Image/preload';
import { s } from '@onekeyhq/components/src/utils/scale';
import { getTokenImageResizeWidth } from '@onekeyhq/kit/src/components/Token/tokenSize';
import { deferHeavyWorkUntilUIIdle } from '@onekeyhq/kit/src/utils/deferHeavyWork';
import type {
  IBorrowMarketItem,
  IBorrowReserveItem,
} from '@onekeyhq/shared/types/staking';

import { buildBorrowPositionEntries } from './borrowMobilePositions.utils';
import { filterUnsupportedAaveNativeReserveAssets } from './borrowRepayPosition.utils';
import { isBorrowAssetVisible } from './collateralControls.utils';

export type IBorrowImagePrewarmSource = {
  uri: string;
  resizeWidth: number;
};

type IBorrowMarketIconSize = 'md' | 'sm';

type IQueuedImage = {
  key: string;
  source: IBorrowImagePrewarmSource;
  owners: Map<number, IImageOwner>;
  priority: 0 | 1;
};

type IImageOwner = {
  priority: 0 | 1;
  onSettled?: (success: boolean) => void;
};

const MAX_TRACKED_IMAGE_VARIANTS = 128;
const PREWARMED_IMAGE_TTL = 30 * 1000;
const MAX_VISIBLE_ASSET_ICONS = 8;
const MAX_VISIBLE_POSITION_ICONS = 4;
const MAX_VISIBLE_ASSET_ROW_ICONS = 4;

const prewarmedImageVariants = new Map<string, number>();
const queuedImageVariants = new Map<string, IQueuedImage>();
const pendingImages: IQueuedImage[] = [];
const activeImageKeys = new Set<string>();
const activeImageItems = new Map<string, IQueuedImage>();
let nextOwnerId = 0;
let isDrainingForeground = false;
let isDrainingBackground = false;
let foregroundDrainPromise: Promise<void> | undefined;
let resolveForegroundDrain: (() => void) | undefined;
let foregroundDrainId = 0;
let activeForegroundImage: IQueuedImage | undefined;
let cacheGeneration = 0;

export function invalidateBorrowImagePrewarmCache() {
  cacheGeneration += 1;
  prewarmedImageVariants.clear();
}

function getImageVariantKey(source: IBorrowImagePrewarmSource) {
  return `${source.resizeWidth}:${source.uri}`;
}

function isRecentlyPrewarmed(key: string) {
  const prewarmedAt = prewarmedImageVariants.get(key);
  if (prewarmedAt === undefined) {
    return false;
  }
  const age = Date.now() - prewarmedAt;
  if (age < 0 || age >= PREWARMED_IMAGE_TTL) {
    prewarmedImageVariants.delete(key);
    return false;
  }
  return true;
}

function releaseObsoleteForegroundDrain() {
  if (
    !activeForegroundImage ||
    [...activeForegroundImage.owners.values()].some(
      (owner) => owner.priority === 1,
    )
  ) {
    return;
  }
  // The native preload cannot be cancelled. Release its JS lane so the newest
  // selected market can start, while the old request finishes independently.
  foregroundDrainId += 1;
  activeForegroundImage = undefined;
  isDrainingForeground = false;
  resolveForegroundDrain?.();
  resolveForegroundDrain = undefined;
  foregroundDrainPromise = undefined;
  if (pendingImages.some((item) => item.priority === 1)) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    void drainPendingImages(1);
  }
}

function settleImageOwners(item: IQueuedImage, success: boolean) {
  item.owners.forEach((owner) => owner.onSettled?.(success));
}

function addImageSource(
  sources: IBorrowImagePrewarmSource[],
  uri: string | undefined,
  resizeWidth: number,
) {
  const trimmedUri = uri?.trim();
  if (trimmedUri) {
    sources.push({ uri: trimmedUri, resizeWidth });
  }
}

export function getBorrowMarketIconSources(
  market: IBorrowMarketItem,
  size: IBorrowMarketIconSize,
): IBorrowImagePrewarmSource[] {
  const sources: IBorrowImagePrewarmSource[] = [];
  addImageSource(sources, market.logoURI, getTokenImageResizeWidth(size));
  // Token's md/sm network badges render at $4/$3, respectively.
  addImageSource(
    sources,
    market.network.logoURI,
    getBorrowMarketNetworkLogoResizeWidth(size),
  );
  return sources;
}

export function getBorrowMarketNetworkLogoResizeWidth(
  size: IBorrowMarketIconSize,
): number {
  return s(size === 'md' ? 16 : 12);
}

export function getBorrowVisibleAssetIconSources({
  reserves,
  market,
  section = 'supply',
}: {
  reserves: IBorrowReserveItem;
  market: Pick<IBorrowMarketItem, 'networkId' | 'provider'>;
  section?: 'supply' | 'borrow';
}): IBorrowImagePrewarmSource[] {
  const sources: IBorrowImagePrewarmSource[] = [];
  const positionAssets = buildBorrowPositionEntries({
    suppliedAssets: reserves.supplied.assets,
    borrowedAssets: reserves.borrowed.assets,
  }).map((entry) => entry.asset);
  const rowAssets =
    section === 'supply'
      ? filterUnsupportedAaveNativeReserveAssets({
          assets: reserves.supply.assets,
          networkId: market.networkId,
          providerName: market.provider,
        }).toSorted(
          (left, right) =>
            new BigNumber(right.walletBalance?.fiatValue || '0').comparedTo(
              new BigNumber(left.walletBalance?.fiatValue || '0'),
            ) ?? 0,
        )
      : filterUnsupportedAaveNativeReserveAssets({
          assets: reserves.borrow.assets,
          networkId: market.networkId,
          providerName: market.provider,
        })
          .filter(isBorrowAssetVisible)
          .toSorted(
            (left, right) =>
              new BigNumber(right.available?.fiatValue || '0').comparedTo(
                new BigNumber(left.available?.fiatValue || '0'),
              ) ?? 0,
          );

  positionAssets.slice(0, MAX_VISIBLE_POSITION_ICONS).forEach((asset) => {
    addImageSource(
      sources,
      asset.token.logoURI,
      getTokenImageResizeWidth('lg'),
    );
  });
  rowAssets.slice(0, MAX_VISIBLE_ASSET_ROW_ICONS).forEach((asset) => {
    addImageSource(
      sources,
      asset.token.logoURI,
      getTokenImageResizeWidth('md'),
    );
  });

  return [
    ...new Map(
      sources.map((source) => [getImageVariantKey(source), source]),
    ).values(),
  ].slice(0, MAX_VISIBLE_ASSET_ICONS);
}

async function drainPendingImages(priority: 0 | 1) {
  if (priority ? isDrainingForeground : isDrainingBackground) {
    return;
  }
  if (priority) {
    foregroundDrainId += 1;
  }
  const drainId = foregroundDrainId;
  if (priority) {
    isDrainingForeground = true;
    foregroundDrainPromise = new Promise<void>((resolve) => {
      resolveForegroundDrain = resolve;
    });
  } else {
    isDrainingBackground = true;
  }
  try {
    while (pendingImages.some((item) => item.priority === priority)) {
      if (priority && drainId !== foregroundDrainId) {
        break;
      }
      if (!priority) {
        // Catalog work waits for an idle frame; the selected market does not.
        // eslint-disable-next-line no-await-in-loop
        await deferHeavyWorkUntilUIIdle({ minFrames: 1 });
        // An already started catalog request may finish, but the next one
        // waits until the selected market's images have had the network.
        let activeForeground = foregroundDrainPromise;
        while (activeForeground) {
          // eslint-disable-next-line no-await-in-loop
          await activeForeground;
          activeForeground = foregroundDrainPromise;
        }
      }
      const nextIndex = pendingImages.findIndex(
        (item) => item.priority === priority,
      );
      if (nextIndex >= 0) {
        const [next] = pendingImages.splice(nextIndex, 1);
        queuedImageVariants.delete(next.key);
        if (next.owners.size > 0 && !isRecentlyPrewarmed(next.key)) {
          activeImageKeys.add(next.key);
          activeImageItems.set(next.key, next);
          const requestCacheGeneration = cacheGeneration;
          if (priority) {
            activeForegroundImage = next;
          }
          let success = false;
          try {
            // eslint-disable-next-line no-await-in-loop
            const didPreload = await preloadImage(next.source);
            success = didPreload && requestCacheGeneration === cacheGeneration;
            if (success) {
              if (prewarmedImageVariants.size >= MAX_TRACKED_IMAGE_VARIANTS) {
                prewarmedImageVariants.clear();
              }
              prewarmedImageVariants.set(next.key, Date.now());
            }
          } catch {
            // An image failure should not block the rest of the market catalog.
          } finally {
            settleImageOwners(next, success);
            activeImageKeys.delete(next.key);
            activeImageItems.delete(next.key);
            if (activeForegroundImage === next) {
              activeForegroundImage = undefined;
            }
          }
        }
      }
    }
  } finally {
    if (priority && drainId === foregroundDrainId) {
      isDrainingForeground = false;
      resolveForegroundDrain?.();
      resolveForegroundDrain = undefined;
      foregroundDrainPromise = undefined;
    } else if (!priority) {
      isDrainingBackground = false;
    }
    if (pendingImages.some((item) => item.priority === priority)) {
      void drainPendingImages(priority);
    }
  }
}

export function prewarmBorrowImages(
  sources: IBorrowImagePrewarmSource[],
  options?: {
    priority?: boolean;
    onSettled?: (success: boolean) => void;
  },
): () => void {
  nextOwnerId += 1;
  const ownerId = nextOwnerId;
  const priority = options?.priority ? 1 : 0;
  const owner: IImageOwner = {
    priority,
    onSettled: options?.onSettled,
  };
  const seen = new Set<string>();
  for (const source of sources) {
    const key = getImageVariantKey(source);
    if (!seen.has(key)) {
      seen.add(key);
      if (isRecentlyPrewarmed(key)) {
        owner.onSettled?.(true);
      } else {
        const active = activeImageItems.get(key);
        if (active) {
          active.owners.set(ownerId, owner);
        } else {
          const queued = queuedImageVariants.get(key);
          if (queued) {
            queued.owners.set(ownerId, owner);
            if (priority) {
              queued.priority = 1;
            }
          } else {
            const item: IQueuedImage = {
              key,
              source,
              owners: new Map([[ownerId, owner]]),
              priority,
            };
            queuedImageVariants.set(key, item);
            pendingImages.push(item);
          }
        }
      }
    }
  }
  if (pendingImages.length > 0) {
    void drainPendingImages(1);
    void drainPendingImages(0);
  }
  return () => {
    for (let index = pendingImages.length - 1; index >= 0; index -= 1) {
      const item = pendingImages[index];
      item.owners.delete(ownerId);
      if (item.owners.size === 0) {
        queuedImageVariants.delete(item.key);
        pendingImages.splice(index, 1);
      } else {
        item.priority = [...item.owners.values()].some(
          (itemOwner) => itemOwner.priority === 1,
        )
          ? 1
          : 0;
      }
    }
    const hadActiveForegroundOwner = Boolean(
      activeForegroundImage?.owners.has(ownerId),
    );
    activeImageItems.forEach((item) => {
      item.owners.delete(ownerId);
    });
    if (hadActiveForegroundOwner) {
      releaseObsoleteForegroundDrain();
    }
  };
}

export function prewarmBorrowImagesAndWait(
  sources: IBorrowImagePrewarmSource[],
  options?: { priority?: boolean },
): { promise: Promise<boolean>; cancel: () => void } {
  let resolvePromise: (success: boolean) => void = () => undefined;
  let isSettled = false;
  const uniqueSources = [
    ...new Map(
      sources.map((source) => [getImageVariantKey(source), source]),
    ).values(),
  ];
  let pendingCount = uniqueSources.length;
  let didFail = false;
  const promise = new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
  });
  const settle = (success: boolean) => {
    if (isSettled) {
      return;
    }
    didFail ||= !success;
    pendingCount -= 1;
    if (pendingCount <= 0) {
      isSettled = true;
      resolvePromise(!didFail);
    }
  };
  if (pendingCount === 0) {
    isSettled = true;
    resolvePromise(true);
    return { promise, cancel: () => undefined };
  }
  const cancelPrewarm = prewarmBorrowImages(uniqueSources, {
    priority: options?.priority,
    onSettled: settle,
  });
  return {
    promise,
    cancel: () => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      cancelPrewarm();
      resolvePromise(false);
    },
  };
}

export function createBorrowImagePrewarmSession(scopeKey: string) {
  const cancelers = new Map<string, () => void>();
  let active = true;
  return {
    scopeKey,
    enqueue(key: string, sources: IBorrowImagePrewarmSource[]) {
      if (!active || sources.length === 0 || cancelers.has(key)) {
        return;
      }
      cancelers.set(key, prewarmBorrowImages(sources));
    },
    cancel() {
      active = false;
      cancelers.forEach((cancel) => cancel());
      cancelers.clear();
    },
  };
}
