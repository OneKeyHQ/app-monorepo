import { createSlice } from '@reduxjs/toolkit';

export const slice = createSlice({
  name: 'status',
  initialState: {
    loginAt: 0,
    isLogin: false,
    welcomed: false,
    initialized: false,
  },
  reducers: {
    setWelcomed: (state) => {
      // finish onboarding flow
      state.welcomed = true;
    },
    setInitialized: (state) => {
      // finish password setup
      state.initialized = true;
    },
    reset: (state) => {
      state.loginAt = 0;
    },
    login: (state) => {
      state.loginAt = Date.now();
      state.isLogin = true;
    },
    logout: (state) => {
      state.isLogin = false;
    },
  },
});

export const { reset, setWelcomed, setInitialized, login, logout } =
  slice.actions;

export default slice.reducer;
