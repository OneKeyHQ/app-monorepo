import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { merge } from 'lodash';

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
      // TODO deep compare and assign values
      state.symbolList = Object.keys(action.payload);
      const newMap = merge({}, state.map, action.payload);
      state.map = newMap;
    },
  },
});

export const { updateFiatMoneyMap } = fiatMoneySlice.actions;

export default fiatMoneySlice.reducer;
