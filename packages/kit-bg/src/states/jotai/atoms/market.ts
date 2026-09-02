import {
  type ITradingViewNativeChartSettings,
  type ITradingViewNativeIndicatorSettings,
  createTradingViewNativeChartSettings,
  createTradingViewNativeIndicatorSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IMarketSelectedTab = 'watchlist' | 'trending' | 'perps';

export interface IMarketSelectedTabAtom {
  tab: IMarketSelectedTab;
  selectedSpotCategory?: string;
  spotCategoryToSelect?: string;
  selectedPerpsCategory?: string;
  perpsCategoryToSelect?: string;
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

export type IMarketTradingViewStorageNamespace = 'market';

export interface IMarketTradingViewSubIndicatorCountPersistAtom {
  subIndicatorCountByStorageNamespace: Partial<
    Record<IMarketTradingViewStorageNamespace, number>
  >;
}

export const {
  target: marketTradingViewSubIndicatorCountPersistAtom,
  use: useMarketTradingViewSubIndicatorCountPersistAtom,
} = globalAtom<IMarketTradingViewSubIndicatorCountPersistAtom>({
  persist: true,
  name: EAtomNames.marketTradingViewSubIndicatorCountPersistAtom,
  initialValue: {
    subIndicatorCountByStorageNamespace: {},
  },
});

export const {
  target: marketTradingViewChartSettingsPersistAtom,
  use: useMarketTradingViewChartSettingsPersistAtom,
} = globalAtom<ITradingViewNativeChartSettings>({
  persist: true,
  name: EAtomNames.marketTradingViewChartSettingsPersistAtom,
  initialValue: createTradingViewNativeChartSettings(),
});

export const {
  target: marketTradingViewIndicatorSettingsPersistAtom,
  use: useMarketTradingViewIndicatorSettingsPersistAtom,
} = globalAtom<ITradingViewNativeIndicatorSettings>({
  persist: true,
  name: EAtomNames.marketTradingViewIndicatorSettingsPersistAtom,
  initialValue: createTradingViewNativeIndicatorSettings(),
});

export type IMarketDetailChartDisplayMode = 'simple' | 'pro';

export interface IMarketDetailChartDisplayModePersistAtom {
  mode: IMarketDetailChartDisplayMode;
}

export const {
  target: marketDetailChartDisplayModePersistAtom,
  use: useMarketDetailChartDisplayModePersistAtom,
} = globalAtom<IMarketDetailChartDisplayModePersistAtom>({
  persist: true,
  name: EAtomNames.marketDetailChartDisplayModePersistAtom,
  initialValue: { mode: 'simple' },
});

export type IMarketPriceSource = 'share' | 'token';

export interface IMarketPriceSourceAtom {
  source: IMarketPriceSource;
}

// Which price series the stock detail page shows: the underlying share or the
// tokenized instrument. Global state because more than one surface reads it —
// the price header renders the figures and the chart has to plot the matching
// series, otherwise the header and the chart contradict each other.
// Deliberately not persisted, so it never survives a restart. Not persisting is
// not enough on its own: the atom is global and lives across navigations, so a
// Token Price selection would carry into the next stock opened in the same
// session. The stock detail page resets it to 'share' on entry and whenever the
// stock changes (StockDesktopLayout), which is what makes every visit start on
// the share price the page is named after.
export const { target: marketPriceSourceAtom, use: useMarketPriceSourceAtom } =
  globalAtom<IMarketPriceSourceAtom>({
    persist: false,
    name: EAtomNames.marketPriceSourceAtom,
    initialValue: { source: 'share' },
  });
