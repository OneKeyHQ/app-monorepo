export enum ENFTType {
  ERC721 = 'ERC-721',
  ERC1155 = 'ERC-1155',
}

export enum ETraitsDisplayType {
  String = 'string',
  Date = 'date',
  Number = 'number',
}

export type ITraits = {
  trait_type: string;
  display_type: ETraitsDisplayType;
  displayType: ETraitsDisplayType;
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
    image?: string;
    itemUrl: string;
    name?: string;
    attributes?: ITraits[];
  };

  accountId?: string;
  networkId?: string;
};

export type IFetchAccountNFTsParams = {
  accountId: string;
  networkId: string;
  cursor?: string;
  limit?: number;
  isAllNetworks?: boolean;
  isManualRefresh?: boolean;

  allNetworksAccountId?: string;
  allNetworksNetworkId?: string;
  saveToLocal?: boolean;
};

export type IFetchAccountNFTsResp = {
  data: IAccountNFT[];
  next: string;
  networkId?: string;
  isSameAllNetworksAccountData?: boolean;
};

export type IFetchNFTDetailsParams = {
  accountId: string;
  networkId: string;
  nfts: { collectionAddress: string; itemId: string }[];
};

export type IFetchNFTDetailsResp = {
  data: IAccountNFT[];
};

export type INFTMetaData = {
  header: string;
  subheader: string;
  network: string;
  owner: string;
};
