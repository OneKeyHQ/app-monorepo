import { createSlice } from '@reduxjs/toolkit';

import type { PayloadAction } from '@reduxjs/toolkit';

export interface IPortfolioUpdatedAt {
  updatedAt: number;
}

export interface IOverviewPortfolio {
  portfolios: Record<string, IPortfolioUpdatedAt>;
}

const initialState: IOverviewPortfolio = {
  portfolios: {},
};

export const overviewSlice = createSlice({
  name: 'overview',
  initialState,
  reducers: {
    serOverviewPortfolioUpdatedAt(
      state,
      action: PayloadAction<{
        // networkId__accountId
        key: string;
        data: IPortfolioUpdatedAt;
      }>,
    ) {
      const { data, key } = action.payload;
      if (!state.portfolios) {
        state.portfolios = {};
      }
      state.portfolios[key] = data;
    },
  },
});

export const { serOverviewPortfolioUpdatedAt } = overviewSlice.actions;

export default overviewSlice.reducer;
