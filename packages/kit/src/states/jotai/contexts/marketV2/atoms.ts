import memoizee from 'memoizee';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  atom,
  createJotaiContext,
} from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import type { IMarketWatchListDataV2 } from '@onekeyhq/shared/types/market';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

const {
  Provider: ProviderJotaiContextMarketV2,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export { ProviderJotaiContextMarketV2, contextAtomMethod };

export const { atom: basicMarketWatchListV2Atom, useContextAtom } =
  contextAtom<IMarketWatchListDataV2>({ data: [] });

export const {
  atom: marketV2StorageReadyAtom,
  use: useMarketV2StorageReadyAtom,
} = contextAtom<boolean>(false);

// Token Detail Atoms
export const { atom: tokenDetailAtom, use: useTokenDetailAtom } = contextAtom<
  IMarketTokenDetail | undefined
>(undefined);

export const { atom: tokenDetailLoadingAtom, use: useTokenDetailLoadingAtom } =
  contextAtom<boolean>(false);

export const { atom: tokenAddressAtom, use: useTokenAddressAtom } =
  contextAtom<string>('');

export const { atom: networkIdAtom, use: useNetworkIdAtom } =
  contextAtom<string>('');

export const { atom: leftColumnWidthAtom, use: useLeftColumnWidthAtom } =
  contextAtom<number>(0);

export const { atom: showWatchlistOnlyAtom, use: useShowWatchlistOnlyAtom } =
  contextAtom<boolean>(false);

export const { atom: selectedNetworkIdAtom, use: useSelectedNetworkIdAtom } =
  contextAtom<string>('sol--101');

export const { atom: selectedMarketTabAtom, use: useSelectedMarketTabAtom } =
  contextAtom<string>('trending');

const INIT = Symbol('INIT');
export const marketWatchListV2Atom = memoizee(() =>
  atom(
    (get) => ({
      ...get(basicMarketWatchListV2Atom()),
      isMounted: get(marketV2StorageReadyAtom()),
    }),
    (get, set, arg: any) => {
      if (arg === INIT) {
        void backgroundApiProxy.serviceMarketV2
          .getMarketWatchListV2()
          .then((data) => {
            set(basicMarketWatchListV2Atom(), data);
            set(marketV2StorageReadyAtom(), true);
          });
      } else {
        set(basicMarketWatchListV2Atom(), arg);
      }
    },
  ),
);

marketWatchListV2Atom().onMount = (setAtom) => {
  setAtom(INIT);
};

export const useMarketWatchListV2Atom = () =>
  useContextAtom(marketWatchListV2Atom());
