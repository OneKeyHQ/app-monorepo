import memoizee from 'memoizee';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  // eslint-disable-next-line @typescript-eslint/no-restricted-imports
  atom,
  createJotaiContext,
} from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import {
  EAmountEnterType,
  ESlippageSetting,
} from '@onekeyhq/shared/src/logger/scopes/dex/types';
import type { IMarketWatchListDataV2 } from '@onekeyhq/shared/types/market';
import type {
  IMarketTokenDetail,
  IMarketTokenDetailWebsocket,
} from '@onekeyhq/shared/types/marketV2';

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

export const {
  atom: tokenDetailWebsocketAtom,
  use: useTokenDetailWebsocketAtom,
} = contextAtom<IMarketTokenDetailWebsocket | undefined>(undefined);

export const { atom: tokenAddressAtom, use: useTokenAddressAtom } =
  contextAtom<string>('');

export const { atom: networkIdAtom, use: useNetworkIdAtom } =
  contextAtom<string>('');

export const { atom: isNativeAtom, use: useIsNativeAtom } =
  contextAtom<boolean>(false);

export const { atom: showWatchlistOnlyAtom, use: useShowWatchlistOnlyAtom } =
  contextAtom<boolean>(false);

export const { atom: selectedNetworkIdAtom, use: useSelectedNetworkIdAtom } =
  contextAtom<string>('sol--101');

export const { atom: selectedMarketTabAtom, use: useSelectedMarketTabAtom } =
  contextAtom<string>('trending');

// SwapPanel Analytics Atoms
export interface ISwapAnalyticsState {
  amountEnterType: EAmountEnterType;
  slippageSetting: ESlippageSetting;
}

const initialSwapAnalyticsState: ISwapAnalyticsState = {
  amountEnterType: EAmountEnterType.Manual,
  slippageSetting: ESlippageSetting.Auto,
};

export const { atom: swapAnalyticsAtom, use: useSwapAnalyticsAtom } =
  contextAtom<ISwapAnalyticsState>(initialSwapAnalyticsState);

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
          })
          .catch((error) => {
            console.error('Failed to fetch initial watchlist data:', error);
            // Still set as ready even if failed, to avoid hanging the UI
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
