import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IMarketSelectedTab = 'watchlist' | 'trending' | 'perps';

export interface IMarketSelectedTabAtom {
  tab: IMarketSelectedTab;
}

export const { target: marketSelectedTabAtom, use: useMarketSelectedTabAtom } =
  globalAtom<IMarketSelectedTabAtom>({
    persist: true,
    name: EAtomNames.marketSelectedTabAtom,
    initialValue: { tab: 'trending' },
  });

export interface IMarketBannerListSortAtom {
  sortBy: string | undefined;
  sortType: 'asc' | 'desc' | undefined;
}

export const {
  target: marketBannerListSortAtom,
  use: useMarketBannerListSortAtom,
} = globalAtom<IMarketBannerListSortAtom>({
  persist: true,
  name: EAtomNames.marketBannerListSortAtom,
  initialValue: { sortBy: undefined, sortType: undefined },
});

export interface IMarketCurrentTokenLiveData {
  networkId: string;
  address: string;
  price?: number;
  change24h?: number;
  marketCap?: number;
  liquidity?: number;
  transactions?: number;
  uniqueTraders?: number;
  holders?: number;
  turnover?: number;
  walletInfo?: { buy: number; sell: number };
}

export const {
  target: marketCurrentTokenLiveDataAtom,
  use: useMarketCurrentTokenLiveDataAtom,
} = globalAtom<IMarketCurrentTokenLiveData | undefined>({
  persist: false,
  name: EAtomNames.marketCurrentTokenLiveDataAtom,
  initialValue: undefined,
});

export interface IMarketTokenSelectorConfigAtom {
  isWatchlistMode: boolean;
  spotNetworkId: string;
}

export const {
  target: marketTokenSelectorConfigAtom,
  use: useMarketTokenSelectorConfigAtom,
} = globalAtom<IMarketTokenSelectorConfigAtom>({
  persist: true,
  name: EAtomNames.marketTokenSelectorConfigAtom,
  initialValue: {
    isWatchlistMode: false,
    spotNetworkId: '',
  },
});
