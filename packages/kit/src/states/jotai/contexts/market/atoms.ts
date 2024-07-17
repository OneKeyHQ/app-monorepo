import memoizee from 'memoizee';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  atom,
  createJotaiContext,
} from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import type { IMarketWatchListData } from '@onekeyhq/shared/types/market';

const {
  Provider: ProviderJotaiContextMarketWatchList,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export { ProviderJotaiContextMarketWatchList, contextAtomMethod };

export const { atom: basicMarketWatchListAtom, useContextAtom } =
  contextAtom<IMarketWatchListData>({ data: [] });

export const { atom: marketStorageReadyAtom, use: useMarketStorageReadyAtom } =
  contextAtom<boolean>(false);

const INIT = Symbol('INIT');
export const marketWatchListAtom = memoizee(() =>
  atom(
    (get) => ({
      ...get(basicMarketWatchListAtom()),
      isMounted: get(marketStorageReadyAtom()),
    }),
    (get, set, arg: any) => {
      if (arg === INIT) {
        void backgroundApiProxy.simpleDb.marketWatchList
          .getMarketWatchList()
          .then((data) => {
            set(basicMarketWatchListAtom(), data);
            set(marketStorageReadyAtom(), true);
          });
      } else {
        set(basicMarketWatchListAtom(), arg);
      }
    },
  ),
);

marketWatchListAtom().onMount = (setAtom) => {
  setAtom(INIT);
};

export const useMarketWatchListAtom = () =>
  useContextAtom(marketWatchListAtom());
