import type { Dispatch, SetStateAction } from 'react';
import { createContext, useContext } from 'react';

import type { Network } from '@onekeyhq/engine/src/types/network';
import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';

export type LiveMintListContextValue = {
  isTab: boolean;
  loading?: boolean;
  selectedNetwork?: Network;
  liveMintList?: NFTAsset[];
};

export type ILiveMintListContent = {
  context: LiveMintListContextValue;
  setContext: Dispatch<SetStateAction<LiveMintListContextValue>>;
};

export const LiveMintListContext = createContext<ILiveMintListContent | null>(
  null,
);

export function useLiveMintContext() {
  return useContext(LiveMintListContext);
}
