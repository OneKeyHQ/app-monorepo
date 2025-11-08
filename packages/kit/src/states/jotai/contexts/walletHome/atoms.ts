import type { IPopularTradingToken } from '@onekeyhq/shared/types/swap/types';

import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextWalletHome,
  withProvider: withWalletHomeProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export {
  ProviderJotaiContextWalletHome,
  contextAtomMethod,
  withWalletHomeProvider,
};

export const { atom: popularTradingAtom, use: usePopularTradingAtom } =
  contextAtom<{
    popularTradingTokens: IPopularTradingToken[];
    lastUpdatedAt: number;
  }>({
    popularTradingTokens: [],
    lastUpdatedAt: 0,
  });

export const {
  atom: popularTradingStateAtom,
  use: usePopularTradingStateAtom,
} = contextAtom<{
  isInitialized: boolean;
  isLoading: boolean;
}>({
  isInitialized: false,
  isLoading: false,
});
