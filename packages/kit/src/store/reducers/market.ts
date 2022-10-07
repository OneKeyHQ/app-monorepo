import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import natsort from 'natsort';
import { TokenChartData } from './tokens';

export const MARKET_FAVORITES_CATEGORYID = 'favorites';

type CoingeckoId = string;
type CategoryId = string;

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
  price?: number;
  priceChangePercentage24H?: number;
  sparkline?: number[];
  marketCap?: number;
  totalVolume?: number;
  favorited?: boolean;
  implChainIds?: string[];
};

export type MarketTokenDetail = {
  stats?: MarketStats;
  about?: Record<string, string>;
  explorers?: MarketEXplorer[];
  news?: MarketNews[];
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
  categoryId: string;
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

type MarketTokenIpmlChainIdPayloadAction = {
  coingeckoId: CoingeckoId;
  implChainIds: string[];
};

export type MarketInitialState = {
  selectedCategoryId?: CategoryId;
  categorys: Record<CategoryId, MarketCategory>;
  marketTokens: Record<CoingeckoId, MarketTokenItem>;
  charts: Record<CoingeckoId, Record<string, TokenChartData>>;
  detail: Record<CoingeckoId, MarketTokenDetail>;
  listSort: MarketListSortType | null;
};

const initialState: MarketInitialState = {
  categorys: {},
  marketTokens: {},
  listSort: null,
  charts: {},
  detail: {},
};

function equalStringArr(arr1: string[], arr2: string[]) {
  return (
    arr1.length === arr2.length && arr1.every((value) => arr2.includes(value))
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
      // check categorys
      const { categorys } = state;
      const cacheCategory = categorys[categoryId];
      if (cacheCategory) {
        const fetchCoingeckoIds = marketTokens.map((t) => t.coingeckoId);
        if (!cacheCategory.coingeckoIds) {
          cacheCategory.coingeckoIds = fetchCoingeckoIds;
        } else if (
          // ban favorite category coingecko ids change
          categoryId !== MARKET_FAVORITES_CATEGORYID &&
          !equalStringArr(cacheCategory.coingeckoIds, fetchCoingeckoIds) &&
          state.listSort === null
        ) {
          cacheCategory.coingeckoIds = fetchCoingeckoIds;
        }
      }
      // check favorites
      const favoriteCategory = categorys[MARKET_FAVORITES_CATEGORYID];
      marketTokens.forEach((t) => {
        t.favorited =
          favoriteCategory &&
          favoriteCategory.coingeckoIds?.includes(t.coingeckoId);
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
        const index = favoriteCategory.coingeckoIds?.indexOf(payload);
        if (index !== undefined && index !== -1) {
          favoriteCategory.coingeckoIds?.splice(index, 1);
        }
        favoriteCategory.coingeckoIds?.unshift(payload);
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
      state.detail[coingeckoId] = data;
    },
    // updateMarketInfo(state, action: PayloadAction<InfoPayloadAction>) {
    //   const { coingeckoId, info } = action.payload;
    //   const oldInfo = state.infos[coingeckoId] || {};
    //   state.infos[coingeckoId] = { ...oldInfo, ...info };
    // },
    // updateMarketStats(state, action: PayloadAction<StatsPayloadAction>) {
    //   const { coingeckoId, stats } = action.payload;
    //   const oldStats = state.infos[coingeckoId] || {};
    //   state.stats[coingeckoId] = { ...oldStats, ...stats };
    // },
    // updateMarketNews(state, action: PayloadAction<NewsPayloadAction>) {
    //   const { coingeckoId, news } = action.payload;
    //   state.news[coingeckoId] = news;
    // },
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
                        marketTokens[id1].symbol ?? '',
                        marketTokens[id2].symbol ?? '',
                      )
                    : natsort({ insensitive: true })(
                        marketTokens[id2].symbol ?? '',
                        marketTokens[id1].symbol ?? '',
                      );
                }
                case 3: {
                  return payload.direction === 'down'
                    ? (marketTokens[id1].price ?? 0) -
                        (marketTokens[id2].price ?? 0)
                    : (marketTokens[id2].price ?? 0) -
                        (marketTokens[id1].price ?? 0);
                }
                case 4:
                case 7: {
                  return payload.direction === 'down'
                    ? (marketTokens[id1].priceChangePercentage24H ?? 0) -
                        (marketTokens[id2].priceChangePercentage24H ?? 0)
                    : (marketTokens[id2].priceChangePercentage24H ?? 0) -
                        (marketTokens[id1].priceChangePercentage24H ?? 0);
                }
                case 5: {
                  console.log('id1Price', marketTokens[id1].totalVolume);
                  console.log('id2Price', marketTokens[id2].totalVolume);
                  return payload.direction === 'down'
                    ? (marketTokens[id1].totalVolume ?? 0) -
                        (marketTokens[id2].totalVolume ?? 0)
                    : (marketTokens[id2].totalVolume ?? 0) -
                        (marketTokens[id1].totalVolume ?? 0);
                }
                case 6: {
                  return payload.direction === 'down'
                    ? (marketTokens[id1].marketCap ?? 0) -
                        (marketTokens[id2].marketCap ?? 0)
                    : (marketTokens[id2].marketCap ?? 0) -
                        (marketTokens[id1].marketCap ?? 0);
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
    updateMarketTokenIpmlChainId(
      state,
      action: PayloadAction<MarketTokenIpmlChainIdPayloadAction>,
    ) {
      const { coingeckoId, implChainIds } = action.payload;
      const cacheMarketToken = state.marketTokens[coingeckoId];
      if (cacheMarketToken) {
        if (
          !cacheMarketToken.implChainIds ||
          !equalStringArr(implChainIds, cacheMarketToken.implChainIds)
        ) {
          cacheMarketToken.implChainIds = implChainIds;
        }
      }
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
  updateMarketTokenIpmlChainId,
} = MarketSlicer.actions;

export default MarketSlicer.reducer;
