import { Action, ThunkAction, configureStore } from '@reduxjs/toolkit';

import accountReducer from './reducers/account';
import autoUpdateReducer from './reducers/autoUpdater';
import chainReducer from './reducers/chain';

export function makeStore() {
  return configureStore({
    reducer: {
      autoUpdate: autoUpdateReducer,
      chain: chainReducer,
      account: accountReducer,
    },
  });
}

const store = makeStore();

export type AppState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;

export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  AppState,
  unknown,
  Action<string>
>;

export default store;
