import { createSlice } from '@reduxjs/toolkit';
import { isEqual } from 'lodash';

import type { PayloadAction } from '@reduxjs/toolkit';

export type TExchangeRate = {
  name?: string;
  value?: number;
  unit?: string;
  type?: string[];
  key?: string;
};

type InitialState = {
  symbolList: string[];
  map: Record<string, TExchangeRate>;
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
      const newMap = { ...action.payload };
      if (!isEqual(state.map, newMap)) {
        state.map = newMap;
      }
    },
  },
});

export const { updateFiatMoneyMap } = fiatMoneySlice.actions;

export default fiatMoneySlice.reducer;
