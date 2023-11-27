export type IERCNFTType = 'erc721' | 'erc1155';

export type Traits = {
  traitType: string;
  value: string;
};

export type INFTAssetModelEVM = {
  networkId?: string;
  accountAddress?: string;
  tokenAddress?: string; // sol
  contractAddress?: string; // evm
  contractName?: string;
  contractTokenId?: string;
  tokenId?: string; // evm
  ercType?: IERCNFTType;
  amount?: string;
  value?: string;
  owner: string;
  tokenUri: string | null;
  contentType: string | null;
  imageUri?: string;
  contentUri: string | null;
  nftscanUri: string | null;
  mintPrice?: number;
  mintTimestamp?: number;
  latestTradePrice?: number;
  latestTradeSymbol?: string;
  assetAttributes?: {
    attribute_name: string;
    attribute_value: string;
    percentage: string;
  }[];
  name?: string;
  description?: string;
  attributes?: Traits[];
  image: {
    source: string;
    thumbnail: string;
  };
  collection: {
    contractName?: string;
    logoUrl?: string;
    floorPrice?: number;
    openseaVerified?: boolean;
  };
};

export type ICollectionAttribute = {
  attributes_name: string;
  attributes_values: {
    attributes_value: string;
    total: number;
  }[];
};

export type ICollection = {
  networkId?: string;
  accountAddress?: string;
  contractAddress?: string;
  contractName?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  ownsTotal?: string;
  floorPrice?: number;
  priceSymbol?: string;
  assets: INFTAssetModelEVM[];
  totalPrice: number;
  collectionId?: string;
  chain?: string;
  ercType?: string;
  attributes?: ICollectionAttribute[];
  name?: string;
  itemsTotal?: number;
  ownersTotal?: number;
  amountsTotal?: number;
  volume24h?: number;
  openseaVerified?: boolean;
  royalty?: number;
  hasAttributes?: boolean;
  blueChip?: {
    next_blue_chip_probability: string | null;
  } | null;
};

export type IAccountNFT = INFTAssetModelEVM;
