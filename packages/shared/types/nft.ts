export enum ENFTType {
  ERC721 = 'ERC-721',
  ERC1155 = 'ERC-1155',
}

export type ITraits = {
  traitType: string;
  value: string;
};

export type IAccountNFT = {
  amount: string;
  collectionAddress: string;
  collectionName: string;
  collectionSymbol: string;
  collectionType: ENFTType;
  itemId: string;
  metadata?: {
    description: string;
    externalUrl: string;
    image: string;
    itemUrl: string;
    name: string;
    attributes?: ITraits[];
  };
};

export type IFetchAccountNFTsParams = {
  networkId: string;
  accountAddress: string;
  cursor?: string;
  limit?: number;
};

export type IFetchAccountNFTsResp = {
  data: IAccountNFT[];
  next: string;
};

export type IFetchNFTDetailsParams = {
  networkId: string;
  accountAddress?: string;
  params: {
    itemId: string;
    collectionAddress?: string;
  }[];
};

export type IFetchNFTDetailsResp = {
  data: IAccountNFT[];
};
