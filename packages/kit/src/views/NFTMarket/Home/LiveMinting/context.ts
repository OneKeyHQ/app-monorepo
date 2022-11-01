import { createContext, useContext } from 'react';

import { Network } from '@onekeyhq/engine/src/types/network';
import { NFTAsset } from '@onekeyhq/engine/src/types/nft';

export type LiveMintListContextValue = {
  isTab: boolean;
  loading?: boolean;
  selectedNetwork?: Network;
  liveMintList?: NFTAsset[];
};

export type ILiveMintListContent = {
  context: LiveMintListContextValue;
  setContext: React.Dispatch<React.SetStateAction<LiveMintListContextValue>>;
};

export const LiveMintListContext = createContext<ILiveMintListContent | null>(
  null,
);

export function useLiveMintContext() {
  return useContext(LiveMintListContext);
}
