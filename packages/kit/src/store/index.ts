import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Action,
  Dispatch,
  PayloadAction,
  ThunkAction,
  combineReducers,
  configureStore,
} from '@reduxjs/toolkit';
import { cloneDeep, isFunction, isString } from 'lodash';
import { Reducer } from 'redux';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from 'redux-persist';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IBackgroundApi } from '../background/BackgroundApiProxy';

import autoUpdateReducer from './reducers/autoUpdater';
import chainReducer from './reducers/chain';
import counter from './reducers/counter';
import fiatMoneyReducer from './reducers/fiatMoney';
import generalReducer from './reducers/general';
import networkReducer from './reducers/network';
import settingsReducer from './reducers/settings';
import statusReducer from './reducers/status';
import walletReducer from './reducers/wallet';

const allReducers = combineReducers({
  autoUpdate: autoUpdateReducer,
  chain: chainReducer,
  wallet: walletReducer,
  settings: settingsReducer,
  status: statusReducer,
  network: networkReducer,
  general: generalReducer,
  fiatMoney: fiatMoneyReducer,
  counter,
});

function rootReducer(reducers: Reducer, initialState = {}): any {
  const higherState = {
    state: initialState,
  };
  return function (state = {}, action: PayloadAction): any {
    switch (action.type) {
      case 'REPLACE_WHOLE_STATE':
        higherState.state = action.payload as any;
        return higherState.state;
      case 'LOGOUT':
        return reducers(undefined, action);
      default:
        return reducers(state, action);
    }
  };
}

const persistConfig = {
  key: 'ONEKEY_WALLET',
  version: 1,
  storage: AsyncStorage,
  whitelist: ['settings', 'status'],
};

export function makeStore() {
  const persistedReducer = persistReducer(
    persistConfig,
    rootReducer(allReducers) as typeof allReducers,
  );
  const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      }),
  });
  const persistor = persistStore(store);
  return { store, persistor };
}

const { store, persistor: persistorStore } = makeStore();
export const persistor = persistorStore;

export type IAppState = ReturnType<typeof store.getState>;

export type IAppDispatch = typeof store.dispatch;

export type IAppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  IAppState,
  unknown,
  Action<string>
>;

let backgroundDispatch: IAppDispatch | ((action: any) => void) | null = null;

export async function appDispatch(
  action: PayloadAction<any> | ((dispatch: Dispatch) => Promise<unknown>),
) {
  const bgApi: IBackgroundApi = global.$backgroundApiProxy;
  if (!bgApi) {
    throw new Error('Please init backgroundApiProxy first');
  }

  if (!backgroundDispatch) {
    backgroundDispatch = bgApi.dispatchAction.bind(bgApi);
  }

  if (isFunction(action)) {
    const asyncAction = action as (dispatch: Dispatch) => Promise<unknown>;
    await asyncAction(backgroundDispatch as Dispatch);
  } else if (backgroundDispatch) {
    backgroundDispatch(action);
  }
}

export function appSelector(selector: (state: IAppState) => any): any {
  return selector(store.getState());
}

if (platformEnv.isDev) {
  // @ts-ignore
  global.$$isString = isString;
  global.$$appStore = store;
  global.$$appDispatch = appDispatch;
  global.$$appSelector = appSelector;
  // @ts-ignore
  global.$$testReplaceWholeState = () => {
    const s = cloneDeep({ ...global.$$appStore.getState() });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    s.counter.value = parseFloat(Date.now().toString().slice(5));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    global.$$appDispatch({ payload: s, type: 'REPLACE_WHOLE_STATE' });
  };
}

export default store;
