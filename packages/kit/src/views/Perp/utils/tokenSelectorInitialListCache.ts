import {
  type ITokenSearchAliases,
  getTokenSubtitle,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

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

export function buildPerpsTokenSelectorInitialList({
  assetsByDex,
  tokenSearchAliases,
  limit = PERPS_TOKEN_SELECTOR_INITIAL_LIST_LIMIT,
}: {
  assetsByDex: IPerpsUniverse[][];
  tokenSearchAliases?: ITokenSearchAliases;
  limit?: number;
}) {
  const result: IPerpsTokenSelectorInitialListItem[] = [];
  for (let dexIndex = 0; dexIndex < assetsByDex.length; dexIndex += 1) {
    const assets = assetsByDex[dexIndex] ?? [];
    for (let index = 0; index < assets.length; index += 1) {
      const asset = assets[index];
      if (!asset.isDelisted) {
        result.push({
          dexIndex,
          index,
          assetId: asset.assetId,
          tokenName: asset.name,
          tokenMaxLeverage: asset.maxLeverage,
          tokenSubtitle: getTokenSubtitle(asset.name, tokenSearchAliases),
        });
      }
      if (result.length >= limit) {
        return result;
      }
    }
  }
  return result;
}

export function setCachedPerpsTokenSelectorInitialList(
  items: IPerpsTokenSelectorInitialListItem[],
) {
  cachedInitialList = items;
}

export function getCachedPerpsTokenSelectorInitialList() {
  return cachedInitialList;
}
