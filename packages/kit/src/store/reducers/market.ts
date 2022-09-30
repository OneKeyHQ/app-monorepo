import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export type MarketCategory = {
  name?: string;
  categoryId: string;
  type: 'tab' | 'search';
  coingeckoIds?: string[]; // for favorites
  defaultSelected?: boolean;
};

export type MarketTokenItem = {
  name?: string;
  symbol?: string;
  // serialNumber?: number; // token 序号
  coingeckoId: string;
  image?: string;
  price?: number;
  priceChangePercentage24H?: number;
  sparkline?: number[];
  marketCap?: number;
  totalVolume?: number;
};

export type MarketCategoryTokenPayload = {
  categoryId: string;
  marketTokens: MarketTokenItem[];
};

export type MarketInitialState = {
  currentCategory?: MarketCategory;
  categorys: MarketCategory[];
  categoryTokenMap: Record<string, MarketTokenItem[]>;
};

const initialState: MarketInitialState = {
  categorys: [],
  categoryTokenMap: {},
};
export const MarketSlicer = createSlice({
  name: 'market',
  initialState,
  reducers: {
    // 分类列表，
    saveMarketCategorys(state, action: PayloadAction<MarketCategory[]>) {
      state.categorys = action.payload;
    },
    updataMarketCategoryTokenMap(
      state,
      action: PayloadAction<MarketCategoryTokenPayload>,
    ) {
      const { payload } = action;
      const categoryTokenMap = { ...state.categoryTokenMap };
      // categoryTokenMap
      console.log('categoryTokenMap', categoryTokenMap);
      categoryTokenMap[payload.categoryId] = payload.marketTokens;
      state.categoryTokenMap = categoryTokenMap;
    },
    updataCurrentCategory(state, action: PayloadAction<MarketCategory>) {
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
  },
});

export const {
  saveMarketCategorys,
  updataMarketCategoryTokenMap,
  updataCurrentCategory,
  cancleMarketFavorite,
  saveMarketFavorite,
} = MarketSlicer.actions;

export default MarketSlicer.reducer;
