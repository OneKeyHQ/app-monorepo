export const NFTChainMap: Record<string, string> = {
  'evm--1': 'eth',
  'evm--56': 'bsc',
  'evm--137': 'polygon',
};

export type ERCType = 'erc721' | 'erc1155';
export type Traits = {
  traitType: string;
  value: string;
};

export type Collectible = {
  contractAddress?: string;
  contractName?: string;
  symbol?: string;
  description?: string;
  website?: string;
  email?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  github?: string;
  instagram?: string;
  medium?: string;
  logoUrl?: string;
  bannerUrl?: string;
  featuredUrl?: string;
  largeImageUrl?: string;
  attributes?: string;
  ercType?: string;
  deployBlockNumber?: string;
  owner?: string;
  verified?: string;
  royalty?: string;
  itemsTotal?: string;
  ownersTotal?: string;
  openseaFloorPrice?: string;
  collectionsWithSameName?: string;
  assets: NFTScanAsset[];
};

export type NFTScanAsset = {
  contractAddress: string;
  contractTokenId: string;
  tokenId: string;
  contractName?: string;
  ercType?: string;
  minter?: string;
  amount?: string;
  owner: string;
  mintTimestamp?: string;
  mintTransactionHash?: string;
  mintPrice?: string;
  tokenUri: string | null;
  metadataJson: string | null;
  contentType: string | null;
  contentUri: string | null;
  imageUri: string | null;
  externalLink?: string;
  latestTradePrice?: string;
  latestTradeTimestamp?: string;
  nftscanId?: string;
  nftscanUri: string | null;
  name?: string;

  // parse from metadataJson
  description?: string;
  attributes?: Traits[];
  chain?: string;
};

export type NFTScanMetadata = {
  name?: string;
  title?: string;
  image?: string;
  attributes?: Traits[];
  animationUrl?: string;
  description?: string;
};

export type NFTScanNFTsResp = {
  code?: number;
  data: Collectible[];
};
