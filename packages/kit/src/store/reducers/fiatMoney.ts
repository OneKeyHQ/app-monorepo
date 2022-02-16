import { PayloadAction, createSlice } from '@reduxjs/toolkit';

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
      state.symbolList = Object.keys(action.payload);
      state.map = action.payload;
    },
  },
});

export const { updateFiatMoneyMap } = fiatMoneySlice.actions;

export default fiatMoneySlice.reducer;
