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

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IBackgroundApi } from '../background/BackgroundApiProxy';

import accountReducer from './reducers/account';
import autoUpdateReducer from './reducers/autoUpdater';
import chainReducer from './reducers/chain';
import counter from './reducers/counter';

const allReducers = combineReducers({
  autoUpdate: autoUpdateReducer,
  chain: chainReducer,
  account: accountReducer,
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
      default:
        return reducers(state, action);
    }
  };
}

export function makeStore() {
  return configureStore({
    reducer: rootReducer(allReducers) as typeof allReducers,
  });
}

const store = makeStore();

export type IAppState = ReturnType<typeof store.getState>;

export type IAppDispatch = typeof store.dispatch;

export type IAppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  IAppState,
  unknown,
  Action<string>
>;

let backgroundDispatch: IAppDispatch | ((action: any) => void) | null = null;

// eslint-disable-next-line @typescript-eslint/require-await
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
