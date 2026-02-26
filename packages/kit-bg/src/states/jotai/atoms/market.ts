import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IMarketSelectedTab = 'watchlist' | 'trending' | 'perps';

export interface IMarketSelectedTabAtom {
  tab: IMarketSelectedTab;
}

export const { target: marketSelectedTabAtom, use: useMarketSelectedTabAtom } =
  globalAtom<IMarketSelectedTabAtom>({
    persist: true,
    name: EAtomNames.marketSelectedTabAtom,
    initialValue: { tab: 'trending' },
  });

// Per-network token preference for Market Detail Buy/Sell
// Stores the user's last selected payment token per network
// Buy and Sell share the same preference
export interface IMarketTokenPreferenceItem {
  contractAddress: string;
  symbol: string;
  networkId: string;
}

export interface IMarketTokenPreferencePersistAtom {
  // key: networkId, value: user's preferred payment token
  preferences: Record<string, IMarketTokenPreferenceItem>;
}

export const {
  target: marketTokenPreferencePersistAtom,
  use: useMarketTokenPreferencePersistAtom,
} = globalAtom<IMarketTokenPreferencePersistAtom>({
  persist: true,
  name: EAtomNames.marketTokenPreferencePersistAtom,
  initialValue: { preferences: {} },
});
