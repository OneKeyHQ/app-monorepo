import { createContext, useContext } from 'react';

import {
  Collection,
  NFTAsset,
  NFTTransaction,
} from '@onekeyhq/engine/src/types/nft';

export type CollectionDetailContextValue = {
  collection?: Collection;
  selectedIndex: number;
  refreshing?: boolean;
  assetList: NFTAsset[];
  txList: NFTTransaction[];
  networkId: string;
};

export type ICollectionDetailContent = {
  context: CollectionDetailContextValue;
  setContext: React.Dispatch<
    React.SetStateAction<CollectionDetailContextValue>
  >;
};

export const CollectionDetailContext =
  createContext<ICollectionDetailContent | null>(null);

export function useCollectionDetailContext() {
  return useContext(CollectionDetailContext);
}
