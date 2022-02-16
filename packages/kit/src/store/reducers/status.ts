import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export const slice = createSlice({
  name: 'status',
  initialState: {
    password: '',
    lastLoginAt: 0,
  },
  reducers: {
    setPassword: (state, action: PayloadAction<string>) => {
      state.password = action.payload;
    },
    reset: (state) => {
      state.password = '';
      state.lastLoginAt = 0;
    },
    refreshLoginAt: (state) => {
      state.lastLoginAt = Date.now();
    },
  },
});

export const { setPassword, reset, refreshLoginAt } = slice.actions;

export default slice.reducer;
