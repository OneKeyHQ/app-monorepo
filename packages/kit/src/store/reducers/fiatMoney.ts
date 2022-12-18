import { createSlice } from '@reduxjs/toolkit';
import { isEqual, merge } from 'lodash';

import type { PayloadAction } from '@reduxjs/toolkit';

type InitialState = {
  symbolList: string[];
  map: Record<string, string>;
};

const initialState: InitialState = {
  symbolList: [],
  map: {},
};

export const fiatMoneySlice = createSlice({
  name: 'fiatMoney',
  initialState,
  reducers: {
    updateFiatMoneyMap(state, action: PayloadAction<InitialState['map']>) {
      const symbolList = Object.keys(action.payload);
      if (!isEqual(state.symbolList, symbolList)) {
        state.symbolList = symbolList;
      }
      const newMap = merge({}, state.map, action.payload);
      if (!isEqual(state.map, newMap)) {
        state.map = newMap;
      }
    },
  },
});

export const { updateFiatMoneyMap } = fiatMoneySlice.actions;

export default fiatMoneySlice.reducer;
