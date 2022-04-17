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
import appStorage, {
  mockStorage,
} from '@onekeyhq/shared/src/storage/appStorage';

import { IBackgroundApi } from '../background/IBackgroundApi';
import { ensureBackgroundObject } from '../background/utils';

import middlewares from './middlewares';
import autoUpdateReducer from './reducers/autoUpdater';
import dappReducer from './reducers/dapp';
import dataReducer from './reducers/data';
import discoverReducer from './reducers/discover';
import fiatMoneyReducer from './reducers/fiatMoney';
import generalReducer from './reducers/general';
import runtimeReducer from './reducers/runtime';
import settingsReducer from './reducers/settings';
import statusReducer from './reducers/status';
import swapReducer from './reducers/swap';

const allReducers = combineReducers({
  autoUpdate: autoUpdateReducer,
  runtime: runtimeReducer,
  settings: settingsReducer,
  status: statusReducer,
  general: generalReducer,
  fiatMoney: fiatMoneyReducer,
  dapp: dappReducer,
  data: dataReducer,
  discover: discoverReducer,
  swap: swapReducer,
});

function rootReducer(reducers: Reducer, initialState = {}): any {
  const higherState = {
    state: initialState,
  };
  return function (state = {}, action: PayloadAction): any {
    switch (action.type) {
      // sync background redux to ui redux
      case 'REPLACE_WHOLE_STATE':
        // return reducers(state, action);
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
  // AsyncStorage not working in ext background (localStorage not available)
  storage: platformEnv.isExtensionUi ? mockStorage : appStorage,
  whitelist: ['settings', 'status', 'dapp', 'general', 'discover'],
  throttle: platformEnv.isExtension ? 1000 : 0, // default=0
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
      }).concat(middlewares),
  });
  const persistor = persistStore(store);
  return { store, persistor };
}

const { store, persistor: persistorStore } = makeStore();

export const persistor = ensureBackgroundObject(persistorStore);

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
    backgroundDispatch = bgApi.dispatch.bind(bgApi);
  }

  if (isFunction(action)) {
    const asyncAction = action as (dispatch: Dispatch) => Promise<unknown>;
    await asyncAction(backgroundDispatch as Dispatch);
    console.error(
      'dispatch async action is NOT allowed, please use backgroundApi instead',
      action,
    );
  } else if (backgroundDispatch) {
    backgroundDispatch(action);
  }
}

export function appSelector(selector: (state: IAppState) => any): any {
  return selector(store.getState());
}
export type IAppSelector = typeof appSelector;

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
    global.$$appDispatch({
      type: 'REPLACE_WHOLE_STATE',
      payload: s,
      $isDispatchFromBackground: true,
    });
  };
}

export type IStore = typeof store;
export type IPersistor = typeof persistorStore;
export default store;
