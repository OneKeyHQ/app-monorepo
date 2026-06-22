import type { ITokenSelectorFavoriteOrderEntry } from '@onekeyhq/shared/src/utils/perpsTokenSelectorFavorites';
import {
  dedupeTokenSelectorFavoriteCoins,
  dedupeTokenSelectorFavoritesOrder,
  getTokenSelectorFavoriteOrderKey,
  reconcileTokenSelectorFavoritesOrder,
  toggleTokenSelectorFavoriteCoin,
  updateTokenSelectorFavoriteCoins,
} from '@onekeyhq/shared/src/utils/perpsTokenSelectorFavorites';
import {
  compareSpotMarketCapValues,
  getSpotMarketCapValue,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpTokenSortDirection,
  IPerpTokenSortField,
  IPerpsAssetCtx,
  ISpotUniverse,
} from '@onekeyhq/shared/types/hyperliquid';
import { XYZ_ASSET_ID_OFFSET } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

type ITokenSelectorFavoriteItem = {
  mode: 'perp' | 'spot';
  coinName: string;
  dexIndex: number;
  assetId: number;
};

type ITokenSelectorListItemLike = {
  dexIndex: number;
  assetId?: number;
};

type ITokenSelectorSortableListItemLike = ITokenSelectorListItemLike & {
  index: number;
  tokenName?: string;
  spotUniverse?: Pick<ISpotUniverse, 'name' | 'baseName'>;
};

type ITokenSelectorFavoriteSortEntry<T extends ITokenSelectorListItemLike> = {
  item: T;
  order: number;
  name?: string;
  markPrice?: number;
  change24hPercent?: number;
  fundingRate?: number;
  volume24h?: number;
  openInterestValue?: number;
  marketCap?: number;
};

type ITokenSelectorPerpSortValues = {
  markPrice: number;
  fundingRate: number;
  volume24h: number;
  openInterestValue: number;
  change24hPercent: number;
};

type ITokenSelectorSpotCtx = {
  markPx?: string;
  markPrice?: string;
  prevDayPx?: string;
  dayNtlVlm?: string | number;
  totalSupply?: string;
  circulatingSupply?: string;
};

function getTokenSelectorFavoriteKey(item: ITokenSelectorListItemLike): string {
  return `${item.dexIndex}-${item.assetId ?? ''}`;
}

function dedupeTokenSelectorFavoriteItems(
  favoriteItems: ITokenSelectorFavoriteItem[],
): ITokenSelectorFavoriteItem[] {
  const seen = new Set<string>();
  return favoriteItems.filter((item) => {
    const key = getTokenSelectorFavoriteOrderKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getTokenSelectorFavoriteItems<T extends ITokenSelectorListItemLike>({
  favoriteItems,
  favoritesOrder,
  perpItems,
  spotItems,
}: {
  favoriteItems: ITokenSelectorFavoriteItem[];
  favoritesOrder: ITokenSelectorFavoriteOrderEntry[];
  perpItems: T[];
  spotItems: T[];
}): T[] {
  const uniqueFavoriteItems = dedupeTokenSelectorFavoriteItems(favoriteItems);

  const perpItemsByKey = new Map(
    perpItems.map((item) => [getTokenSelectorFavoriteKey(item), item]),
  );
  const spotItemsByKey = new Map(
    spotItems.map((item) => [getTokenSelectorFavoriteKey(item), item]),
  );
  const favoriteRowsByOrderKey = new Map<string, T>();

  for (const favorite of uniqueFavoriteItems) {
    const itemKey = getTokenSelectorFavoriteKey(favorite);
    const row =
      favorite.mode === 'spot'
        ? spotItemsByKey.get(itemKey)
        : perpItemsByKey.get(itemKey);
    if (row) {
      favoriteRowsByOrderKey.set(
        getTokenSelectorFavoriteOrderKey(favorite),
        row,
      );
    }
  }

  const ordered: T[] = [];
  const seenOrderKeys = new Set<string>();
  for (const entry of dedupeTokenSelectorFavoritesOrder(favoritesOrder)) {
    const orderKey = getTokenSelectorFavoriteOrderKey(entry);
    const row = favoriteRowsByOrderKey.get(orderKey);
    if (row) {
      ordered.push(row);
      seenOrderKeys.add(orderKey);
    }
  }

  for (const favorite of uniqueFavoriteItems) {
    const orderKey = getTokenSelectorFavoriteOrderKey(favorite);
    if (!seenOrderKeys.has(orderKey)) {
      const row = favoriteRowsByOrderKey.get(orderKey);
      if (row) {
        ordered.push(row);
        seenOrderKeys.add(orderKey);
      }
    }
  }

  return ordered;
}

function getTokenSelectorListItemKey(item: ITokenSelectorSortableListItemLike) {
  if (item.spotUniverse) {
    return `spot-${item.spotUniverse.name}`;
  }
  const assetId = item.assetId ?? item.index;
  return `perp-${item.dexIndex}-${assetId}-${item.tokenName ?? ''}`;
}

function getTokenSelectorFavoriteSortEntry<
  T extends ITokenSelectorSortableListItemLike,
>({
  item,
  order,
  spotPriceSnapshot,
  spotMarketCaps,
  perpAssetCtxsByDex,
  computePerpSortValues,
}: {
  item: T;
  order: number;
  spotPriceSnapshot: Record<string, ITokenSelectorSpotCtx | undefined>;
  spotMarketCaps: Record<string, string>;
  perpAssetCtxsByDex: IPerpsAssetCtx[][] | undefined;
  computePerpSortValues: (
    assetCtx: IPerpsAssetCtx | undefined,
  ) => ITokenSelectorPerpSortValues;
}): ITokenSelectorFavoriteSortEntry<T> {
  if (item.spotUniverse) {
    const ctx = spotPriceSnapshot[item.spotUniverse.name];
    const markPrice = Number(ctx?.markPx || ctx?.markPrice || 0);
    const prevDayPx = Number(ctx?.prevDayPx || 0);
    const change24hPercent =
      prevDayPx > 0 ? ((markPrice - prevDayPx) / prevDayPx) * 100 : 0;
    const volume24h = Number(ctx?.dayNtlVlm || 0);
    const marketCapValue = getSpotMarketCapValue(
      ctx,
      item.spotUniverse.baseName,
      spotMarketCaps,
    );
    const marketCap = marketCapValue ? Number(marketCapValue) : undefined;
    return {
      item,
      order,
      name: item.spotUniverse.baseName,
      markPrice,
      change24hPercent,
      volume24h,
      openInterestValue: marketCap,
      marketCap,
    };
  }

  const itemAssetId = item.assetId ?? item.index;
  const normalizedAssetId =
    item.dexIndex === 1 ? itemAssetId - XYZ_ASSET_ID_OFFSET : itemAssetId;
  const sortValues = computePerpSortValues(
    perpAssetCtxsByDex?.[item.dexIndex]?.[normalizedAssetId],
  );
  return {
    item,
    order,
    name: item.tokenName,
    markPrice: sortValues.markPrice,
    change24hPercent: sortValues.change24hPercent,
    fundingRate: sortValues.fundingRate,
    volume24h: sortValues.volume24h,
    openInterestValue: sortValues.openInterestValue,
  };
}

function sortTokenSelectorFavoriteItems<T extends ITokenSelectorListItemLike>({
  items,
  sortField,
  sortDirection,
  getSortEntry,
}: {
  items: T[];
  sortField?: IPerpTokenSortField | '';
  sortDirection: IPerpTokenSortDirection;
  getSortEntry: (item: T, order: number) => ITokenSelectorFavoriteSortEntry<T>;
}): T[] {
  if (!sortField) {
    return items;
  }

  return items
    .map((item, order) => getSortEntry(item, order))
    .toSorted((a, b) => {
      let compareResult = 0;
      switch (sortField) {
        case 'name':
          compareResult = (a.name ?? '').localeCompare(
            b.name ?? '',
            undefined,
            {
              sensitivity: 'base',
            },
          );
          compareResult =
            sortDirection === 'asc' ? compareResult : -compareResult;
          break;
        case 'markPrice':
          compareResult = compareSpotMarketCapValues(
            a.markPrice,
            b.markPrice,
            sortDirection,
          );
          break;
        case 'change24hPercent':
          compareResult = compareSpotMarketCapValues(
            a.change24hPercent,
            b.change24hPercent,
            sortDirection,
          );
          break;
        case 'fundingRate':
          compareResult = compareSpotMarketCapValues(
            a.fundingRate,
            b.fundingRate,
            sortDirection,
          );
          break;
        case 'volume24h':
          compareResult = compareSpotMarketCapValues(
            a.volume24h,
            b.volume24h,
            sortDirection,
          );
          break;
        case 'openInterest':
          compareResult = compareSpotMarketCapValues(
            a.openInterestValue,
            b.openInterestValue,
            sortDirection,
          );
          break;
        case 'marketCap':
          compareResult = compareSpotMarketCapValues(
            a.marketCap,
            b.marketCap,
            sortDirection,
          );
          break;
        default:
          break;
      }
      return compareResult || a.order - b.order;
    })
    .map((entry) => entry.item);
}

export {
  dedupeTokenSelectorFavoriteCoins,
  dedupeTokenSelectorFavoritesOrder,
  getTokenSelectorFavoriteSortEntry,
  getTokenSelectorFavoriteItems,
  getTokenSelectorListItemKey,
  reconcileTokenSelectorFavoritesOrder,
  sortTokenSelectorFavoriteItems,
  toggleTokenSelectorFavoriteCoin,
  updateTokenSelectorFavoriteCoins,
};
