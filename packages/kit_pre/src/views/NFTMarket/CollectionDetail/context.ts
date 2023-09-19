import type { Dispatch, SetStateAction } from 'react';
import { createContext, useContext } from 'react';

import type {
  Collection,
  NFTAsset,
  NFTTransaction,
} from '@onekeyhq/engine/src/types/nft';

export type CollectionDetailContextValue = {
  collection?: Collection;
  attributes: {
    attribute_name: string;
    attribute_values: string[];
  }[];
  selectedIndex: number;
  refreshing?: boolean;
  assetList: NFTAsset[];
  filterAssetList: NFTAsset[];
  txList: NFTTransaction[];
  networkId: string;
};

export type ICollectionDetailContent = {
  context: CollectionDetailContextValue;
  setContext: Dispatch<SetStateAction<CollectionDetailContextValue>>;
};

export const CollectionDetailContext =
  createContext<ICollectionDetailContent | null>(null);

export function useCollectionDetailContext() {
  return useContext(CollectionDetailContext);
}
