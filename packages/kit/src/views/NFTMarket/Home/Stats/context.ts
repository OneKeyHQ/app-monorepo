import type { Dispatch, SetStateAction } from 'react';
import { createContext, useContext } from 'react';

import type { Network } from '@onekeyhq/engine/src/types/network';
import type {
  NFTMarketCapCollection,
  NFTMarketRanking,
} from '@onekeyhq/engine/src/types/nft';

export type StatsListContextValue = {
  isTab: boolean;
  loading?: boolean;
  selectedNetwork?: Network;
  selectedIndex?: number;
  selectedTime: number; // 0:6h; 1:12h;  2:1d
  rankingList?: NFTMarketRanking[];
  marketCapList?: NFTMarketCapCollection[];
};

export type IStatsListContent = {
  context: StatsListContextValue;
  setContext: Dispatch<SetStateAction<StatsListContextValue>>;
};

export const StatsListContext = createContext<IStatsListContent | null>(null);

export function useStatsListContext() {
  return useContext(StatsListContext);
}
