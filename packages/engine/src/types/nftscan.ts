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
  contractAddress?: string | null;
  contractName?: string | null;
  symbol?: string | null;
  description?: string | null;
  website?: string | null;
  email?: string | null;
  twitter?: string | null;
  discord?: string | null;
  telegram?: string | null;
  github?: string | null;
  instagram?: string | null;
  medium?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  featuredUrl?: string | null;
  largeImageUrl?: string | null;
  attributes?: string | null;
  ercType?: string | null;
  deployBlockNumber?: string | null;
  owner?: string | null;
  verified?: string | null;
  royalty?: string | null;
  itemsTotal?: string | null;
  ownersTotal?: string | null;
  openseaFloorPrice?: string | null;
  collectionsWithSameName?: string | null;
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
  tokenUri?: string;
  metadataJson?: string;
  contentType?: string;
  contentUri?: string;
  imageUri?: string;
  externalLink?: string;
  latestTradePrice?: string;
  latestTradeTimestamp?: string;
  nftscanId?: string;
  nftscanUri?: string;
  name?: string | null;

  // parse from metadataJson
  description?: string | null;
  attributes?: Traits[] | null;
  chain?: string;
};

export type NFTScanMetadata = {
  name?: string | null;
  title?: string | null;
  image?: string | null;
  attributes?: Traits[] | null;
  animationUrl?: string | null;
  description?: string | null;
};

export type NFTScanNFTsResp = {
  code?: number;
  data: Collectible[];
};
