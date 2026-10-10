import memoizee from 'memoizee';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  // eslint-disable-next-line @typescript-eslint/no-restricted-imports
  atom,
  createJotaiContext,
} from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import type { IEarnPermitCache } from '@onekeyhq/shared/types/earn';
import type { IEarnPortfolioPositionsResponse } from '@onekeyhq/shared/types/earn/portfolioPositions';
import type {
  IEarnAtomData,
  IEarnPortfolioInvestment,
} from '@onekeyhq/shared/types/staking';

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
    recommendedTokens: [],
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
    (get, set, arg: typeof INIT | IEarnAtomData) => {
      if (arg === INIT) {
        void backgroundApiProxy.simpleDb.earn.getEarnData().then((data) => {
          set(basicEarnAtom(), {
            ...data,
            earnAccount: data.earnAccount || {},
            availableAssetsByType: data.availableAssetsByType || {},
            recommendedTokens: data.recommendedTokens || [],
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

export const {
  atom: earnPortfolioInvestmentsAtom,
  use: useEarnPortfolioInvestmentsAtom,
} = contextAtom<Record<string, IEarnPortfolioInvestment[]>>({});

/**
 * Phone positions page (OK-61377): the last response of every
 * (account, network, provider) scope, keyed by scope under the earn account
 * key, so the page renders what it showed last time the moment it opens and
 * each scope is replaced in place as its refresh lands.
 */
export const {
  atom: earnPortfolioPositionsAtom,
  use: useEarnPortfolioPositionsAtom,
} = contextAtom<
  Record<string, Record<string, IEarnPortfolioPositionsResponse>>
>({});

export const useEarnAtom = () => useContextAtom(earnAtom());
