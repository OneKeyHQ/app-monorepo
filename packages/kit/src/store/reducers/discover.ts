import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { RankingsPayload, SyncRequestPayload } from '../../views/Discover/type';

export type DiscoverHistory = {
  clicks: number;
  timestamp: number;
};

type InitialState = {
  history: Record<string, DiscoverHistory>;
  syncData: SyncRequestPayload;
  firstRemindDAPP: boolean;
  rankData: RankingsPayload;
};

const initialState: InitialState = {
  history: {},
  syncData: { timestamp: 0, banners: [], increment: {} },
  firstRemindDAPP: true,
  rankData: { tags: [] },
};

export const discoverSlice = createSlice({
  name: 'discover',
  initialState,
  reducers: {
    updateHistory(state, action: PayloadAction<string>) {
      const history = state.history[action.payload];
      if (history) {
        state.history[action.payload] = {
          'clicks': (history?.clicks ?? 1) + 1,
          'timestamp': new Date().getTime(),
        };
      } else {
        state.history[action.payload] = {
          'clicks': 1,
          'timestamp': new Date().getTime(),
        };
      }
    },
    updateSyncData(state, action: PayloadAction<InitialState['syncData']>) {
      state.syncData = action.payload;
    },
    updateFirstRemindDAPP(state, action: PayloadAction<boolean>) {
      state.firstRemindDAPP = action.payload;
    },
    updateRankData(state, action: PayloadAction<InitialState['rankData']>) {
      state.rankData = action.payload;
    },
  },
});

export const {
  updateHistory,
  updateSyncData,
  updateFirstRemindDAPP,
  updateRankData,
} = discoverSlice.actions;

export default discoverSlice.reducer;
