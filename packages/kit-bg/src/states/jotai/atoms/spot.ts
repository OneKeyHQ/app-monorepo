import type {
  IPerpsFrontendOrder,
  ISpotBalance,
  ISpotFormattedAssetCtx,
  ISpotTokenSelectorConfig,
  ISpotUniverse,
} from '@onekeyhq/shared/types/hyperliquid';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export interface ISpotActiveAssetAtom {
  coin: string;
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

export type ISpotPairDisplayMap = Record<string, string>;
export const {
  target: spotPairDisplayMapAtom,
  use: useSpotPairDisplayMapAtom,
} = globalAtom<ISpotPairDisplayMap>({
  name: EAtomNames.spotPairDisplayMapAtom,
  initialValue: {},
});

export interface ISpotAssetCtxEntry {
  markPx: string;
  prevDayPx?: string;
  dayNtlVlm?: string;
  circulatingSupply?: string;
}
export type ISpotAssetCtxsMap = Record<string, ISpotAssetCtxEntry>;
export const { target: spotAssetCtxsMapAtom, use: useSpotAssetCtxsMapAtom } =
  globalAtom<ISpotAssetCtxsMap>({
    name: EAtomNames.spotAssetCtxsMapAtom,
    initialValue: {},
  });

// Display-order only — membership still lives in
// {perp,spot}TokenFavoritesPersistAtom. Held separately so a single sequence
// can interleave both modes for cross-mode drag-reorder.
export interface IPerpsFavoritesOrderEntry {
  mode: 'perp' | 'spot';
  coinName: string;
}
export interface IPerpsFavoritesOrder {
  sequence: IPerpsFavoritesOrderEntry[];
}
export const {
  target: perpsFavoritesOrderPersistAtom,
  use: usePerpsFavoritesOrderPersistAtom,
} = globalAtom<IPerpsFavoritesOrder>({
  name: EAtomNames.perpsFavoritesOrderPersistAtom,
  persist: true,
  initialValue: { sequence: [] },
});
