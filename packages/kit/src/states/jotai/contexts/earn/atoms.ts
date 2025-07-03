import memoizee from 'memoizee';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  atom,
  createJotaiContext,
} from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import type { IEarnPermitCache } from '@onekeyhq/shared/types/earn';
import type { IEarnAtomData } from '@onekeyhq/shared/types/staking';

const {
  Provider: ProviderJotaiContextEarn,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export { ProviderJotaiContextEarn, contextAtomMethod };

export const { atom: basicEarnAtom, useContextAtom } =
  contextAtom<IEarnAtomData>({
    earnAccount: {},
    availableAssetsByType: {},
    refreshTrigger: 0,
  });

export const { atom: earnStorageReadyAtom, use: useEarnStorageReadyAtom } =
  contextAtom<boolean>(false);

const INIT = Symbol('INIT');
export const earnAtom = memoizee(() =>
  atom(
    (get) => ({
      ...get(basicEarnAtom()),
      isMounted: get(earnStorageReadyAtom()),
    }),
    (get, set, arg: any) => {
      if (arg === INIT) {
        void backgroundApiProxy.simpleDb.earn.getEarnData().then((data) => {
          set(basicEarnAtom(), {
            ...data,
            earnAccount: data.earnAccount || {},
            availableAssetsByType: data.availableAssetsByType || {},
            refreshTrigger: data.refreshTrigger || 0,
          });
          set(earnStorageReadyAtom(), true);
        });
      } else {
        set(basicEarnAtom(), arg);
      }
    },
  ),
);

earnAtom().onMount = (setAtom) => {
  setAtom(INIT);
};

export const { atom: earnPermitCacheAtom, use: useEarnPermitCacheAtom } =
  contextAtom<Record<string, IEarnPermitCache>>({});

export const { atom: earnLoadingStatesAtom, use: useEarnLoadingStatesAtom } =
  contextAtom<Record<string, boolean>>({});

export const useEarnAtom = () => useContextAtom(earnAtom());
