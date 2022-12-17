import { createSlice } from '@reduxjs/toolkit';

import type { PayloadAction } from '@reduxjs/toolkit';

export const REDUCER_NAME_SAMPLE = 'sample';

type InitialState = {
  name: string | null;
};

const initialState: InitialState = {
  name: null,
};

export const reducerSlice = createSlice({
  name: REDUCER_NAME_SAMPLE,
  initialState,
  reducers: {
    updateSampleReducerName(
      state,
      action: PayloadAction<InitialState['name']>,
    ) {
      state.name = action.payload;
    },
  },
});

export default reducerSlice;
