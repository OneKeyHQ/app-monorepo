import {
  type ITokenSearchAliases,
  getTokenSubtitle,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpsAssetCtx,
  IPerpsUniverse,
  IWsAllDexsAssetCtxs,
} from '@onekeyhq/shared/types/hyperliquid';
import {
  DEFAULT_PERP_TOKEN_SORT_DIRECTION,
  DEFAULT_PERP_TOKEN_SORT_FIELD,
  XYZ_ASSET_ID_OFFSET,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

export type IPerpsTokenSelectorInitialListItem = {
  dexIndex: number;
  index: number;
  assetId?: number;
  tokenName?: string;
  tokenMaxLeverage?: number;
  tokenSubtitle?: string;
};

const PERPS_TOKEN_SELECTOR_INITIAL_LIST_LIMIT = 72;

let cachedInitialList: IPerpsTokenSelectorInitialListItem[] = [];

function hasAnyAssetCtxs(assetCtxsByDex?: IPerpsAssetCtx[][]) {
  return Boolean(assetCtxsByDex?.some((ctxs) => ctxs?.length > 0));
}

function getAssetCtxByInitialListEntry({
  assetCtxsByDex,
  dexIndex,
  assetId,
}: {
  assetCtxsByDex?: IPerpsAssetCtx[][];
  dexIndex: number;
  assetId?: number;
}) {
  if (typeof assetId !== 'number') {
    return undefined;
  }
  const ctxIndex = dexIndex === 1 ? assetId - XYZ_ASSET_ID_OFFSET : assetId;
  return assetCtxsByDex?.[dexIndex]?.[ctxIndex];
}

function getVolume24hSortValue(assetCtx?: IPerpsAssetCtx) {
  return Number(assetCtx?.dayNtlVlm || 0);
}

export function buildPerpsTokenSelectorInitialList({
  assetsByDex,
  assetCtxsByDex,
  tokenSearchAliases,
  limit = PERPS_TOKEN_SELECTOR_INITIAL_LIST_LIMIT,
  requireDefaultSortSnapshot = false,
}: {
  assetsByDex: IPerpsUniverse[][];
  assetCtxsByDex?: IPerpsAssetCtx[][];
  tokenSearchAliases?: ITokenSearchAliases;
  limit?: number;
  requireDefaultSortSnapshot?: boolean;
}) {
  const canSortByDefaultSnapshot =
    DEFAULT_PERP_TOKEN_SORT_FIELD === 'volume24h' &&
    DEFAULT_PERP_TOKEN_SORT_DIRECTION === 'desc' &&
    hasAnyAssetCtxs(assetCtxsByDex);
  if (requireDefaultSortSnapshot && !canSortByDefaultSnapshot) {
    return [];
  }

  const entries: Array<{
    item: IPerpsTokenSelectorInitialListItem;
    order: number;
    volume24h: number;
  }> = [];
  for (let dexIndex = 0; dexIndex < assetsByDex.length; dexIndex += 1) {
    const assets = assetsByDex[dexIndex] ?? [];
    for (let index = 0; index < assets.length; index += 1) {
      const asset = assets[index];
      if (!asset.isDelisted) {
        const assetCtx = getAssetCtxByInitialListEntry({
          assetCtxsByDex,
          dexIndex,
          assetId: asset.assetId,
        });
        entries.push({
          item: {
            dexIndex,
            index,
            assetId: asset.assetId,
            tokenName: asset.name,
            tokenMaxLeverage: asset.maxLeverage,
            tokenSubtitle: getTokenSubtitle(asset.name, tokenSearchAliases),
          },
          order: entries.length,
          volume24h: getVolume24hSortValue(assetCtx),
        });
      }
    }
  }
  const sortedEntries = canSortByDefaultSnapshot
    ? entries.toSorted((a, b) => b.volume24h - a.volume24h || a.order - b.order)
    : entries;
  return sortedEntries.slice(0, limit).map(({ item }) => item);
}

export function buildPerpsAssetCtxsByDexFromAllDexsSnapshot(
  data?: IWsAllDexsAssetCtxs,
) {
  const ctxMap = new Map<string, IPerpsAssetCtx[]>();
  data?.ctxs?.forEach(([dexName, ctxList]) => {
    ctxMap.set(dexName, ctxList || []);
  });
  const ctxsByDex: IPerpsAssetCtx[][] = [];
  ctxsByDex[0] = ctxMap.get('') ?? ctxMap.get('perps') ?? [];
  ctxsByDex[1] = ctxMap.get('xyz') ?? [];
  return ctxsByDex;
}

export function setCachedPerpsTokenSelectorInitialList(
  items: IPerpsTokenSelectorInitialListItem[],
) {
  cachedInitialList = items;
}

export function getCachedPerpsTokenSelectorInitialList() {
  return cachedInitialList;
}
