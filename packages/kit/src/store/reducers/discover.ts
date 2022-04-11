import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { SyncRequestPayload } from '../../views/Discover/type';

type InitialState = {
  history: Record<string, number>;
  syncData: SyncRequestPayload;
  firstRemindDAPP: boolean;
};

const initialState: InitialState = {
  history: {},
  syncData: { timestamp: 0, banners: [], increment: {} },
  firstRemindDAPP: false,
};

export const discoverSlice = createSlice({
  name: 'discover',
  initialState,
  reducers: {
    updateHistory(state, action: PayloadAction<string>) {
      const num = state.history[action.payload];
      if (num) {
        state.history[action.payload] = num + 1;
      } else {
        state.history[action.payload] = 1;
      }
    },
    updateSyncData(state, action: PayloadAction<InitialState['syncData']>) {
      state.syncData = action.payload;
    },
    updateFirstRemindDAPP(state, action: PayloadAction<boolean>) {
      state.firstRemindDAPP = action.payload;
    },
  },
});

export const { updateHistory, updateSyncData, updateFirstRemindDAPP } =
  discoverSlice.actions;

export default discoverSlice.reducer;
