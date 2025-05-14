import memoizee from 'memoizee';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  atom,
  createJotaiContext,
} from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import type { IMarketWatchListData } from '@onekeyhq/shared/types/market';
import { ESpeedSwapSwitchType } from '@onekeyhq/shared/types/market';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

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

// speed swap
export const {
  atom: speedSwapSwitchTypeAtom,
  use: useSpeedSwapSwitchTypeAtom,
} = contextAtom<ESpeedSwapSwitchType>(ESpeedSwapSwitchType.BUY);

export const { atom: speedSwapFromTokenAtom, use: useSpeedSwapFromTokenAtom } =
  contextAtom<ISwapToken | undefined>(undefined);

export const { atom: speedSwapToTokenAtom, use: useSpeedSwapToTokenAtom } =
  contextAtom<ISwapToken | undefined>(undefined);

export const { atom: speedSwapSlippageAtom, use: useSpeedSwapSlippageAtom } =
  contextAtom<number>(0.5);

export const {
  atom: speedSwapFromTokenAmountAtom,
  use: useSpeedSwapFromTokenAmountAtom,
} = contextAtom<string>('');

export const {
  atom: speedSwapEnableAntiMEVAtom,
  use: useSpeedSwapEnableAntiMEVAtom,
} = contextAtom<boolean>(true);

const INIT = Symbol('INIT');
export const marketWatchListAtom = memoizee(() =>
  atom(
    (get) => ({
      ...get(basicMarketWatchListAtom()),
      isMounted: get(marketStorageReadyAtom()),
    }),
    (get, set, arg: any) => {
      if (arg === INIT) {
        void backgroundApiProxy.serviceMarket
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
