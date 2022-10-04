import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { TokenChartData } from './tokens';

type CoingeckoId = string;

export type MarketCategory = {
  name?: string;
  categoryId: string;
  type: 'tab' | 'search';
  coingeckoIds?: CoingeckoId[];
  defaultSelected?: boolean;
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
  implChainId?: string[];
};

export type MarketEXplorer = {
  iconUrl?: string;
  contractAdrrss?: string;
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

export type MarketInfo = {
  name?: string;
  symbol?: string;
  iconUrl?: string;
  about?: Record<string, string>;
  explorers?: MarketEXplorer[];
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
  lat?: {
    time?: string;
    value?: number;
  };
  ath?: {
    time?: string;
    value?: number;
  };
};

export type MarketCategoryTokenPayload = {
  categoryId: string;
  marketTokens: MarketTokenItem[];
};

type ChartsPayloadAction = {
  coingeckoId: CoingeckoId;
  charts: TokenChartData;
};

type InfoPayloadAction = {
  coingeckoId: CoingeckoId;
  info: MarketInfo;
};
type StatsPayloadAction = {
  coingeckoId: CoingeckoId;
  stats: MarketStats;
};
type NewsPayloadAction = {
  coingeckoId: CoingeckoId;
  news: MarketNews[];
};

export type MarketInitialState = {
  currentCategory?: MarketCategory;
  categorys: MarketCategory[];
  categoryTokenMap: Record<string, MarketTokenItem[]>;
  charts: Record<CoingeckoId, TokenChartData>;
  infos: Record<CoingeckoId, MarketInfo>;
  stats: Record<CoingeckoId, MarketStats>;
  news: Record<CoingeckoId, MarketNews[]>;
};

const initialState: MarketInitialState = {
  categorys: [],
  categoryTokenMap: {},
  charts: {},
  infos: {},
  stats: {},
  news: {},
};
export const MarketSlicer = createSlice({
  name: 'market',
  initialState,
  reducers: {
    // 分类列表，
    saveMarketCategorys(state, action: PayloadAction<MarketCategory[]>) {
      state.categorys = action.payload;
    },
    updateMarketCategoryTokenMap(
      state,
      action: PayloadAction<MarketCategoryTokenPayload>,
    ) {
      const { payload } = action;
      const categoryTokenMap = { ...state.categoryTokenMap };
      // categoryTokenMap
      categoryTokenMap[payload.categoryId] = payload.marketTokens;
      state.categoryTokenMap = categoryTokenMap;
    },
    updateCurrentCategory(state, action: PayloadAction<MarketCategory>) {
      const { payload } = action;
      if (state.categorys.find((c) => c.categoryId === payload.categoryId)) {
        state.currentCategory = { ...payload };
      }
    },
    saveMarketFavorite(state, action: PayloadAction<string>) {
      const { payload } = action;
      const categorys = [...state.categorys];
      const favorite = categorys.find((f) => f.categoryId === 'favorites');
      if (favorite && !favorite.coingeckoIds?.includes(payload)) {
        favorite.coingeckoIds?.push(payload);
      }
      state.categorys = categorys;
    },
    cancleMarketFavorite(state, action: PayloadAction<string>) {
      const { payload } = action;
      const categorys = [...state.categorys];
      const favorite = categorys.find((f) => f.categoryId === 'favorites');
      if (favorite) {
        const index = favorite.coingeckoIds?.indexOf(payload);
        if (index && index !== -1) {
          favorite.coingeckoIds?.splice(index, 1);
        }
      }
      state.categorys = categorys;
    },
    updateChats(state, action: PayloadAction<ChartsPayloadAction>) {
      const { coingeckoId, charts } = action.payload;
      state.charts[coingeckoId] = charts;
    },
    updateMarketInfo(state, action: PayloadAction<InfoPayloadAction>) {
      const { coingeckoId, info } = action.payload;
      const oldInfo = state.infos[coingeckoId] || {};
      state.infos[coingeckoId] = { ...oldInfo, ...info };
    },
    updateMarketStats(state, action: PayloadAction<StatsPayloadAction>) {
      const { coingeckoId, stats } = action.payload;
      const oldStats = state.infos[coingeckoId] || {};
      state.stats[coingeckoId] = { ...oldStats, ...stats };
    },
    updateMarketNews(state, action: PayloadAction<NewsPayloadAction>) {
      const { coingeckoId, news } = action.payload;
      state.news[coingeckoId] = news;
    },
  },
});

export const {
  saveMarketCategorys,
  updateMarketCategoryTokenMap,
  updateCurrentCategory,
  updateChats,
  updateMarketInfo,
  updateMarketStats,
  updateMarketNews,
  cancleMarketFavorite,
  saveMarketFavorite,
} = MarketSlicer.actions;

export default MarketSlicer.reducer;
