export enum ENFTType {
  ERC721 = 'erc721',
  ERC1155 = 'erc1155',
}

export type Traits = {
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
  metadata: {
    description: string;
    externalUrl: string;
    image: string;
    itemUrl: string;
    name: string;
    attributes: Traits[];
  };
};

export type IFetchAccountNFTsParams = {
  networkId: string;
  accountAddress: string;
  xpub?: string;
  page?: number;
  pageSize?: number;
};

export type IFetchAccountNFTsResp = {
  data: IAccountNFT[];
  page: number;
  pageSize: number;
  total: number;
};
