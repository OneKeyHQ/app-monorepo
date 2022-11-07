export enum SearchNFTCollectionRoutes {
  SearchModal = 'SearchModal',
}

export type SearchNFTCollectionRoutesParams = {
  [SearchNFTCollectionRoutes.SearchModal]: {
    onSelectCollection: ({
      networkId,
      contractAddress,
    }: {
      networkId: string;
      contractAddress: string;
    }) => void;
  };
};
