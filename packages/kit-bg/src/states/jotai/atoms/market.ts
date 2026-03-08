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
