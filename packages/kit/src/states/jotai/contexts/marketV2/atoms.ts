import {
  atom,
  createJotaiContext,
} from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import type { IMarketWatchListData } from '@onekeyhq/shared/types/market'; // Assuming similar data structure for now

const {
  Provider: ProviderJotaiContextMarketV2,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export { ProviderJotaiContextMarketV2, contextAtomMethod };

export const { atom: basicMarketV2Atom, useContextAtom } =
  contextAtom<IMarketWatchListData>({ data: [] }); // Simplified initial state

export const {
  atom: marketV2StorageReadyAtom,
  use: useMarketV2StorageReadyAtom,
} = contextAtom<boolean>(false);

const INIT = Symbol('INIT_MARKET_V2');
export const marketV2Atom = () =>
  atom(
    (get) => ({
      ...get(basicMarketV2Atom()),
      isMounted: get(marketV2StorageReadyAtom()),
    }),
    (get, set, arg: any) => {
      if (arg === INIT) {
        // Simplified: Initialize with empty data and set ready to true immediately
        // In a real scenario, you might fetch initial data here
        set(basicMarketV2Atom(), { data: [] });
        set(marketV2StorageReadyAtom(), true);
      } else {
        set(basicMarketV2Atom(), arg);
      }
    },
  );

marketV2Atom().onMount = (setAtom) => {
  setAtom(INIT);
};

export const useMarketV2Atom = () => useContextAtom(marketV2Atom());
