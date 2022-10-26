import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import natsort from 'natsort';

import { ISimpleSearchHistoryToken } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityMarket';

import { Token } from '../typings';

import { TokenChartData } from './tokens';

export const MARKET_FAVORITES_CATEGORYID = 'favorites';
export const MARKET_SEARCH_HISTORY_MAX = 10;
type CoingeckoId = string;
type CategoryId = string;

export enum MarketCategoryType {
  MRKET_CATEGORY_TYPE_TAB = 'tab',
  MRKET_CATEGORY_TYPE_SEARCH = 'search',
}

export const MARKET_TAB_NAME = 'Market';
export const SWAP_TAB_NAME = 'Swap';

type RecomentToken = {
  coingeckoId: string;
  iconUrl?: string;
  name?: string;
  symbol?: string;
};

export type MarketCategory = {
  name?: string;
  categoryId: CategoryId;
  type: 'tab' | 'search';
  coingeckoIds?: CoingeckoId[];
  defaultSelected?: boolean;
  recommendedTokens?: RecomentToken[];
};

export type MarketTokenItem = {
  name?: string;
  symbol?: string;
  // serialNumber?: number; // token 序号
  coingeckoId: CoingeckoId;
  image?: string;
  logoURI?: string;
  price?: number;
  priceChangePercentage24H?: number;
  sparkline?: number[];
  marketCap?: number;
  totalVolume?: number;
  favorited?: boolean;
  tokens?: Token[]; // all netWork tokens
};

export type MarketTokenDetail = {
  stats?: MarketStats;
  about?: string;
  explorers?: MarketEXplorer[];
  news?: MarketNews[];
  priceSubscribe?: boolean;
};

export type MarketEXplorer = {
  iconUrl?: string;
  contractAddress?: string;
  name?: string;
  url?: string;
};

export type MarketNews = {
  url?: string;
  title?: string;
  origin?: string;
  date?: string;
  imageUrl?: string;
};

export type MarketPerformance = {
  priceChangePercentage1h?: number;
  priceChangePercentage24h?: number;
  priceChangePercentage7d?: number;
  priceChangePercentage14d?: number;
  priceChangePercentage30d?: number;
  priceChangePercentage1y?: number;
};

export type MarketStats = {
  performance?: MarketPerformance;
  marketCap?: number;
  marketCapDominance?: string;
  marketCapRank?: number;
  trandingVolume?: string;
  volume24h?: number;
  low7d?: string;
  high7d?: string;
  low24h?: number;
  high24h?: number;
  atl?: {
    time?: string;
    value?: number;
  };
  ath?: {
    time?: string;
    value?: number;
  };
};

export type MarketListSortType = {
  id: number;
  direction: 'up' | 'down';
};

type MarketCategoryTokensPayloadAction = {
  categoryId?: string;
  marketTokens: MarketTokenItem[];
};

type ChartsPayloadAction = {
  coingeckoId: CoingeckoId;
  days: string;
  chart: TokenChartData;
};

type MarketTokenDetailPayloadAction = {
  coingeckoId: CoingeckoId;
  data: MarketTokenDetail;
};

type MarketTokenBasePayloadAction = {
  coingeckoId: CoingeckoId;
  tokens: Token[];
  logoURI?: string;
};

type MarketTokenPriceSubscribeStatusAction = {
  coingeckoIds: CoingeckoId[];
  enable: boolean;
};

type SearchHistoryPayloadAction = {
  token: ISimpleSearchHistoryToken;
};

type SearchHistorySyncPayloadAction = {
  tokens: ISimpleSearchHistoryToken[];
};

type SearchTokenPayloadAction = {
  searchKeyword: string;
  coingeckoIds: CoingeckoId[];
};

export type MarketTopTabName = 'Market' | 'Swap';

export type MarketInitialState = {
  selectedCategoryId?: CategoryId;
  searchTabCategoryId?: CategoryId;
  categorys: Record<CategoryId, MarketCategory>;
  marketTokens: Record<CoingeckoId, MarketTokenItem>;
  charts: Record<CoingeckoId, Record<string, TokenChartData>>;
  details: Record<CoingeckoId, MarketTokenDetail>;
  listSort: MarketListSortType | null;
  marktTobTapName: MarketTopTabName;
  searchHistory?: ISimpleSearchHistoryToken[];
  searchTokens: Record<string, CoingeckoId[]>;
  searchKeyword?: string;
};

const initialState: MarketInitialState = {
  categorys: {},
  marketTokens: {},
  listSort: null,
  charts: {},
  details: {},
  searchTokens: {},
  marktTobTapName: MARKET_TAB_NAME,
};

function equalStringArr(arr1: string[], arr2: string[]) {
  return (
    arr1.length === arr2.length &&
    arr1.every((value, index) => value === arr2[index])
  );
}

export const MarketSlicer = createSlice({
  name: 'market',
  initialState,
  reducers: {
    saveMarketCategorys(state, action: PayloadAction<MarketCategory[]>) {
      const { payload } = action;
      payload.forEach((c) => {
        state.categorys[c.categoryId] = c;
      });
    },
    updateMarketTokens(
      state,
      action: PayloadAction<MarketCategoryTokensPayloadAction>,
    ) {
      const { categoryId, marketTokens } = action.payload;
      const { categorys } = state;
      // check categorys
      if (categoryId) {
        const cacheCategory = categorys[categoryId];
        if (cacheCategory) {
          const fetchCoingeckoIds = marketTokens.map((t) => t.coingeckoId);
          if (!cacheCategory.coingeckoIds) {
            cacheCategory.coingeckoIds = fetchCoingeckoIds;
          } else if (
            !equalStringArr(cacheCategory.coingeckoIds, fetchCoingeckoIds) &&
            state.listSort === null
          ) {
            cacheCategory.coingeckoIds = fetchCoingeckoIds;
          }
        }
      }
      // check favorites
      const favoriteCategory = categorys[MARKET_FAVORITES_CATEGORYID];
      marketTokens.forEach((t) => {
        t.favorited =
          favoriteCategory &&
          favoriteCategory.coingeckoIds?.includes(t.coingeckoId);
        t.symbol = t.symbol ? t.symbol.toUpperCase() : '';
        const cacheMarketToken = state.marketTokens[t.coingeckoId];
        if (cacheMarketToken) {
          Object.assign(cacheMarketToken, t);
        } else {
          state.marketTokens[t.coingeckoId] = t;
        }
      });
    },
    updateSelectedCategory(state, action: PayloadAction<CategoryId>) {
      const { payload } = action;
      state.selectedCategoryId = payload;
    },
    updateSearchTabCategory(
      state,
      action: PayloadAction<CategoryId | undefined>,
    ) {
      const { payload } = action;
      state.searchTabCategoryId = payload;
    },
    saveMarketFavorite(state, action: PayloadAction<string[]>) {
      const { payload } = action;
      const { categorys } = state;
      const favoriteCategory = categorys[MARKET_FAVORITES_CATEGORYID];
      payload.forEach((id) => {
        if (favoriteCategory && !favoriteCategory.coingeckoIds?.includes(id)) {
          favoriteCategory.coingeckoIds?.push(id);
        }
        if (state.marketTokens[id]) {
          state.marketTokens[id].favorited = true;
        } else {
          state.marketTokens[id] = { favorited: true, coingeckoId: id };
        }
      });
    },
    cancleMarketFavorite(state, action: PayloadAction<string>) {
      const { payload } = action;
      const { categorys } = state;
      const favoriteCategory = categorys[MARKET_FAVORITES_CATEGORYID];
      if (favoriteCategory) {
        const index = favoriteCategory.coingeckoIds?.indexOf(payload);
        if (index !== undefined && index !== -1) {
          favoriteCategory.coingeckoIds?.splice(index, 1);
        }
      }
      state.marketTokens[payload].favorited = false;
    },
    moveTopMarketFavorite(state, action: PayloadAction<string>) {
      const { payload } = action;
      const { categorys } = state;
      const favoriteCategory = categorys[MARKET_FAVORITES_CATEGORYID];
      if (favoriteCategory) {
        const favoriteCoingeckoIds = favoriteCategory.coingeckoIds || [];
        const index = favoriteCoingeckoIds?.indexOf(payload);
        if (index !== undefined && index !== -1) {
          favoriteCoingeckoIds?.splice(index, 1);
          favoriteCategory.coingeckoIds = [payload, ...favoriteCoingeckoIds];
        }
      }
    },
    updateMarketChats(state, action: PayloadAction<ChartsPayloadAction>) {
      const { coingeckoId, chart, days } = action.payload;
      state.charts[coingeckoId] = state.charts[coingeckoId] || {};
      state.charts[coingeckoId][days] = chart;
    },
    updateMarketTokenDetail(
      state,
      action: PayloadAction<MarketTokenDetailPayloadAction>,
    ) {
      const { coingeckoId, data } = action.payload;
      const detail = state.details[coingeckoId] || {};
      state.details[coingeckoId] = { ...detail, ...data };
    },
    updateMarketListSort(
      state,
      action: PayloadAction<MarketListSortType | null>,
    ) {
      const { payload } = action;
      state.listSort = payload;
      if (payload) {
        const { selectedCategoryId, marketTokens, categorys } = state;
        if (selectedCategoryId) {
          const categoryTokenIds = categorys[selectedCategoryId].coingeckoIds;
          if (categoryTokenIds) {
            let sortIds = [...categoryTokenIds];
            sortIds = sortIds.sort((id1, id2) => {
              switch (payload.id) {
                case 2: {
                  return payload.direction === 'down'
                    ? natsort({ insensitive: true })(
                        marketTokens[id1]?.symbol ?? '',
                        marketTokens[id2]?.symbol ?? '',
                      )
                    : natsort({ insensitive: true })(
                        marketTokens[id2]?.symbol ?? '',
                        marketTokens[id1]?.symbol ?? '',
                      );
                }
                case 3: {
                  return payload.direction === 'down'
                    ? (marketTokens[id1]?.price ?? 0) -
                        (marketTokens[id2]?.price ?? 0)
                    : (marketTokens[id2]?.price ?? 0) -
                        (marketTokens[id1]?.price ?? 0);
                }
                case 4:
                case 7: {
                  return payload.direction === 'down'
                    ? (marketTokens[id1]?.priceChangePercentage24H ?? 0) -
                        (marketTokens[id2]?.priceChangePercentage24H ?? 0)
                    : (marketTokens[id2]?.priceChangePercentage24H ?? 0) -
                        (marketTokens[id1]?.priceChangePercentage24H ?? 0);
                }
                case 5: {
                  return payload.direction === 'down'
                    ? (marketTokens[id1]?.totalVolume ?? 0) -
                        (marketTokens[id2]?.totalVolume ?? 0)
                    : (marketTokens[id2]?.totalVolume ?? 0) -
                        (marketTokens[id1]?.totalVolume ?? 0);
                }
                case 6: {
                  return payload.direction === 'down'
                    ? (marketTokens[id1]?.marketCap ?? 0) -
                        (marketTokens[id2]?.marketCap ?? 0)
                    : (marketTokens[id2]?.marketCap ?? 0) -
                        (marketTokens[id1]?.marketCap ?? 0);
                }
                default:
                  return 0;
              }
            });
            state.categorys[selectedCategoryId].coingeckoIds = sortIds;
          }
        }
      }
    },
    updateMarketTokensBaseInfo(
      state,
      action: PayloadAction<MarketTokenBasePayloadAction[]>,
    ) {
      const { payload } = action;
      payload.forEach((tokenBase) => {
        const token = state.marketTokens[tokenBase.coingeckoId] || {};
        token.tokens = tokenBase.tokens;
        if (tokenBase.logoURI?.length) {
          token.logoURI = tokenBase.logoURI;
        } else if (token.image) {
          token.logoURI = token.image;
        } else {
          token.logoURI = '';
        }
        state.marketTokens[tokenBase.coingeckoId] = token;
      });
    },
    updateMarketTokenPriceSubscribe(
      state,
      action: PayloadAction<MarketTokenPriceSubscribeStatusAction>,
    ) {
      const { coingeckoIds, enable } = action.payload;
      coingeckoIds.forEach((id) => {
        const detail = state.details[id] || {};
        detail.priceSubscribe = enable;
        state.details[id] = detail;
      });
    },
    switchMarketTopTab(state, action: PayloadAction<MarketTopTabName>) {
      state.marktTobTapName = action.payload;
    },
    saveMarketSearchTokenHistory(
      state,
      action: PayloadAction<SearchHistoryPayloadAction>,
    ) {
      const { token } = action.payload;
      const historys = state.searchHistory ? [...state.searchHistory] : [];
      const findIndex = historys.findIndex(
        (t) => t.coingeckoId === token.coingeckoId,
      );
      if (findIndex !== -1) {
        historys.splice(findIndex, 1);
      }
      if (historys.length >= MARKET_SEARCH_HISTORY_MAX) {
        historys.pop();
      }
      state.searchHistory = [token, ...historys];
    },
    clearMarketSearchTokenHistory(state) {
      state.searchHistory = [];
    },
    syncMarketSearchTokenHistorys(
      state,
      action: PayloadAction<SearchHistorySyncPayloadAction>,
    ) {
      state.searchHistory = action.payload.tokens;
    },
    updateSearchTokens(state, action: PayloadAction<SearchTokenPayloadAction>) {
      const { searchKeyword, coingeckoIds } = action.payload;
      state.searchTokens[searchKeyword] = coingeckoIds;
    },
    updateSearchKeyword(state, action: PayloadAction<string>) {
      state.searchKeyword = action.payload;
    },
  },
});

export const {
  saveMarketCategorys,
  updateMarketTokens,
  updateSelectedCategory,
  updateMarketChats,
  updateMarketTokenDetail,
  cancleMarketFavorite,
  saveMarketFavorite,
  moveTopMarketFavorite,
  updateMarketListSort,
  updateMarketTokensBaseInfo,
  switchMarketTopTab,
  syncMarketSearchTokenHistorys,
  clearMarketSearchTokenHistory,
  saveMarketSearchTokenHistory,
  updateSearchTabCategory,
  updateSearchTokens,
  updateSearchKeyword,
  updateMarketTokenPriceSubscribe,
} = MarketSlicer.actions;

export default MarketSlicer.reducer;
