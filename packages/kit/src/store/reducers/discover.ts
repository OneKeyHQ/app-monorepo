import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { DAppItemType, SyncRequestPayload } from '../../views/Discover/type';

type InitialState = {
  history: DAppItemType[];
  syncData: SyncRequestPayload;
};

const initialState: InitialState = {
  history: [],
  syncData: { timestamp: 0, banners: [], increment: {} },
};

export const discoverSlice = createSlice({
  name: 'discover',
  initialState,
  reducers: {
    updateHistory(state, action: PayloadAction<string>) {
      const dAppItem = {
        ...state.syncData.increment[action.payload],
        id: action.payload,
      };
      if (state.history.length > 0) {
        const tmpArr = state.history.filter(
          (item) => item.id !== action.payload,
        );
        state.history = [dAppItem, ...tmpArr];
      } else {
        state.history = [dAppItem, ...state.history];
      }
    },
    updateSyncData(state, action: PayloadAction<InitialState['syncData']>) {
      state.syncData = action.payload;
    },
  },
});

export const { updateHistory, updateSyncData } = discoverSlice.actions;

export default discoverSlice.reducer;
