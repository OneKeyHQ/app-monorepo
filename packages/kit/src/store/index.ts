import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { cloneDeep, isFunction, isString } from 'lodash';
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

import { REPLACE_WHOLE_STATE } from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage, {
  mockStorage,
} from '@onekeyhq/shared/src/storage/appStorage';

import middlewares from './middlewares';
import { persistWhiteList } from './persistWhiteList';
import allNetworksReducer from './reducers/allNetworks';
import autoUpdateReducer from './reducers/autoUpdater';
import cloudBackupReducer from './reducers/cloudBackup';
import contactsReducer from './reducers/contacts';
import dappReducer from './reducers/dapp';
import dataReducer from './reducers/data';
import discoverReducer from './reducers/discover';
import fiatMoneyReducer from './reducers/fiatMoney';
import generalReducer from './reducers/general';
import hardwareReducer from './reducers/hardware'; // 62.86 MB **** +40 Mb engine/background code
import httpServerReducer from './reducers/httpServer';
import limitOrderReducer from './reducers/limitOrder';
import marketReducer from './reducers/market';
import nftReducer from './reducers/nft';
import overviewReducer from './reducers/overview';
import reducerAccountSelector from './reducers/reducerAccountSelector';
import refresherReducer from './reducers/refresher';
import runtimeReducer from './reducers/runtime';
import settingsReducer from './reducers/settings';
import stakingReducer from './reducers/staking';
import statusReducer from './reducers/status';
import swapReducer from './reducers/swap';
import swapTransactionsReducer from './reducers/swapTransactions';
import tokensReducer from './reducers/tokens';

import type {
  Action,
  Dispatch,
  PayloadAction,
  ThunkAction,
} from '@reduxjs/toolkit';
import type { Reducer } from 'redux';

const allReducers = combineReducers({
  autoUpdate: autoUpdateReducer,
  cloudBackup: cloudBackupReducer,
  contacts: contactsReducer,
  dapp: dappReducer,
  data: dataReducer,
  discover: discoverReducer,
  fiatMoney: fiatMoneyReducer,
  general: generalReducer,
  hardware: hardwareReducer,
  market: marketReducer,
  nft: nftReducer,
  accountSelector: reducerAccountSelector.reducer,
  refresher: refresherReducer,
  runtime: runtimeReducer,
  settings: settingsReducer,
  staking: stakingReducer,
  status: statusReducer,
  swap: swapReducer,
  swapTransactions: swapTransactionsReducer,
  tokens: tokensReducer,
  overview: overviewReducer,
  httpServer: httpServerReducer,
  limitOrder: limitOrderReducer,
  allNetworks: allNetworksReducer,
});

function rootReducer(reducers: Reducer, initialState = {}): any {
  const higherState = {
    state: initialState,
  };
  // eslint-disable-next-line default-param-last, @typescript-eslint/default-param-last
  return function (state = {}, action: PayloadAction): any {
    switch (action.type) {
      // sync background redux to ui redux
      case REPLACE_WHOLE_STATE:
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
  version: 2,
  storage: platformEnv.isExtensionUi ? mockStorage : appStorage,
  whitelist: persistWhiteList,
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
          warnAfter: 1000,
        },
        immutableCheck: { warnAfter: 1000 },
      }).concat(middlewares),
  });
  const persistor = persistStore(store, null, () => {
    debugLogger.common.info(`receive: store persisted`);
    if (platformEnv.isExtensionUi) {
      // extension ui Persistor done does NOT mean redux is ready, UI needs to sync data from background
      //      UI use and check useReduxReady() for details
      appUIEventBus.emit(AppUIEventBusNames.StoreInitedFromPersistor);
    } else {
      global.$appIsReduxReady = true;
      appEventBus.emit(AppEventBusNames.StoreInitedFromPersistor);
    }
  });
  return { store, persistor };
}

const { store, persistor: persistorStore } = makeStore();

// export const persistor = ensureBackgroundObject(persistorStore);
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

let bgApi: typeof global.$backgroundApiProxy | undefined;
// TODO remove
export async function appDispatch(
  action: PayloadAction<any> | ((dispatch: Dispatch) => Promise<unknown>),
) {
  bgApi = bgApi || global.$backgroundApiProxy;
  if (!bgApi) {
    throw new Error('Please init backgroundApiProxy first');
  }

  // remove global.$backgroundApiProxy in production
  if (process.env.NODE_ENV === 'production') {
    try {
      // @ts-ignore
      delete global.$backgroundApiProxy;
    } catch (error) {
      debugLogger.common.error(error);
    }
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

export function appSelector<T>(selector: (state: IAppState) => T): T {
  return selector(store?.getState());
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
      type: REPLACE_WHOLE_STATE,
      payload: s,
      $isDispatchFromBackground: true,
    });
  };
}

export type IStore = typeof store;
export type IPersistor = typeof persistorStore;
export default store;
