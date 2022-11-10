import { Collection } from '@onekeyhq/engine/src/types/nft';

export enum SearchNFTCollectionRoutes {
  SearchModal = 'SearchModal',
}

export type SearchNFTCollectionRoutesParams = {
  [SearchNFTCollectionRoutes.SearchModal]: {
    onSelectCollection: ({
      networkId,
      contractAddress,
      collection,
    }: {
      networkId: string;
      contractAddress: string;
      collection?: Collection;
    }) => void;
  };
};
