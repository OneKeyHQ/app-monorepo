import { createContext, useContext } from 'react';

import { Collection } from '@onekeyhq/engine/src/types/nft';

export type CollectionDetailContextValue = {
  loading?: boolean;
  collection?: Collection;
  selectedIndex: number;
  refreshing?: boolean;
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
