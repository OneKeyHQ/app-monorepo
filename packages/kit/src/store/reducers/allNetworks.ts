import { createSlice } from '@reduxjs/toolkit';

import type { OverviewAllNetworksPortfolioRes } from '../../views/Overview/types';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface AllNetworksState {
  portfolios: Record<string, OverviewAllNetworksPortfolioRes>;
}

const initialState: AllNetworksState = {
  portfolios: {},
};

export const allNetworkSlice = createSlice({
  name: 'allNetworks',
  initialState,
  reducers: {
    setAllNetworksPortfolio(
      state,
      action: PayloadAction<{
        // networkId__accountId
        key: string;
        data: OverviewAllNetworksPortfolioRes;
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

export const { setAllNetworksPortfolio } = allNetworkSlice.actions;

export default allNetworkSlice.reducer;
