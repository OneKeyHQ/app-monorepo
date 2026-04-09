import type {
  IPerpsFrontendOrder,
  ISpotBalance,
  ISpotFormattedAssetCtx,
  ISpotTokenSelectorConfig,
  ISpotUniverse,
  ITradesHistoryData,
} from '@onekeyhq/shared/types/hyperliquid';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

// #region Active Asset
export interface ISpotActiveAssetAtom {
  coin: string; // e.g. "@107" or "PURR/USDC"
  assetId: number | undefined;
  universe: ISpotUniverse | undefined;
}
export const { target: spotActiveAssetAtom, use: useSpotActiveAssetAtom } =
  globalAtom<ISpotActiveAssetAtom>({
    name: EAtomNames.spotActiveAssetAtom,
    persist: true,
    initialValue: {
      coin: '',
      assetId: undefined,
      universe: undefined,
    },
  });

export type ISpotActiveAssetCtxAtom =
  | {
      coin: string;
      assetId: number | undefined;
      ctx: ISpotFormattedAssetCtx;
    }
  | undefined;
export const {
  target: spotActiveAssetCtxAtom,
  use: useSpotActiveAssetCtxAtom,
} = globalAtom<ISpotActiveAssetCtxAtom>({
  name: EAtomNames.spotActiveAssetCtxAtom,
  initialValue: undefined,
});
// #endregion

// #region Balances
export interface ISpotBalancesAtom {
  balances: ISpotBalance[];
  isLoaded: boolean;
}
export const { target: spotBalancesAtom, use: useSpotBalancesAtom } =
  globalAtom<ISpotBalancesAtom>({
    name: EAtomNames.spotBalancesAtom,
    initialValue: {
      balances: [],
      isLoaded: false,
    },
  });
// #endregion

// #region Token Selector
export const {
  target: spotTokenSelectorConfigPersistAtom,
  use: useSpotTokenSelectorConfigPersistAtom,
} = globalAtom<ISpotTokenSelectorConfig | null>({
  name: EAtomNames.spotTokenSelectorConfigPersistAtom,
  persist: true,
  initialValue: {
    field: 'volume24h',
    direction: 'desc',
    activeTab: 'all',
  },
});

export interface ISpotTokenFavorites {
  favorites: string[];
}
export const {
  target: spotTokenFavoritesPersistAtom,
  use: useSpotTokenFavoritesPersistAtom,
} = globalAtom<ISpotTokenFavorites>({
  name: EAtomNames.spotTokenFavoritesPersistAtom,
  persist: true,
  initialValue: {
    favorites: [],
  },
});
// #endregion

// #region Open Orders
export interface ISpotActiveOpenOrdersAtom {
  accountAddress: string | undefined;
  openOrders: IPerpsFrontendOrder[];
}
export const {
  target: spotActiveOpenOrdersAtom,
  use: useSpotActiveOpenOrdersAtom,
} = globalAtom<ISpotActiveOpenOrdersAtom>({
  name: EAtomNames.spotActiveOpenOrdersAtom,
  initialValue: {
    accountAddress: undefined,
    openOrders: [],
  },
});
// #endregion

// #region Spot Pair Display Map
// Maps pair names (@107, PURR/USDC) to display base names (HYPE, PURR)
// Built once during refreshSpotMeta, used by trade history/orders to show readable names
export type ISpotPairDisplayMap = Record<string, string>;
export const {
  target: spotPairDisplayMapAtom,
  use: useSpotPairDisplayMapAtom,
} = globalAtom<ISpotPairDisplayMap>({
  name: EAtomNames.spotPairDisplayMapAtom,
  initialValue: {},
});
// #endregion

// #region Spot Asset Prices
export interface ISpotAssetCtxEntry {
  markPx: string;
  prevDayPx?: string;
  dayNtlVlm?: string;
  circulatingSupply?: string;
}
// coin → context mapping, used by Balance tab (price/PNL) and Token selector (24h change, volume)
export type ISpotAssetCtxsMap = Record<string, ISpotAssetCtxEntry>;
export const { target: spotAssetCtxsMapAtom, use: useSpotAssetCtxsMapAtom } =
  globalAtom<ISpotAssetCtxsMap>({
    name: EAtomNames.spotAssetCtxsMapAtom,
    initialValue: {},
  });
// #endregion

// #region Trades History
export type ISpotTradesHistoryDataAtom = ITradesHistoryData;
export const {
  target: spotTradesHistoryDataAtom,
  use: useSpotTradesHistoryDataAtom,
} = globalAtom<ISpotTradesHistoryDataAtom>({
  name: EAtomNames.spotTradesHistoryDataAtom,
  initialValue: {
    fills: [],
    isLoaded: false,
    latestTime: 0,
    accountAddress: undefined,
  },
});
// #endregion
