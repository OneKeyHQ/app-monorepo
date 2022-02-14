import { createSlice } from '@reduxjs/toolkit';

export const slice = createSlice({
  name: 'status',
  initialState: {
    welcomed: false,
  },
  reducers: {
    finishWelcome: (state) => {
      state.welcomed = true;
    },
  },
});

export const { finishWelcome } = slice.actions;

export default slice.reducer;
