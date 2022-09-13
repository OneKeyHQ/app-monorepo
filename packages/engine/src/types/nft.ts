export const NFTSupportNetworks = [
  'evm--1',
  'evm--10',
  'evm--56',
  'evm--137',
  'evm--42161',
  'sol--101',
];

export type AvailableNetworks = typeof NFTSupportNetworks[number];

export const NFTChainMap: Record<AvailableNetworks, string> = {
  'evm--1': 'eth',
  'evm--10': 'optimism',
  'evm--56': 'bsc',
  'evm--137': 'polygon',
  'evm--42161': 'arbitrum',
  'sol--101': 'sol',
};

export const NFTSymbolMap: Record<AvailableNetworks, string> = {
  'evm--1': 'ethereum',
  'evm--10': 'ethereum',
  'evm--56': 'binancecoin',
  'evm--137': 'weth',
  'evm--42161': 'ethereum',
  'sol--101': 'solana',
};

export type ERCType = 'erc721' | 'erc1155';
export type Traits = {
  traitType: string;
  value: string;
};

export type Collection = {
  contractAddress?: string;
  contractName?: string | null;
  description?: string;
  logoUrl?: string;
  ownsTotal?: string;
  floorPrice?: number;
  priceSymbol?: string;
  assets: NFTAsset[];
  totalPrice: number;
};

export type NFTAsset = {
  tokenAddress?: string;
  contractAddress?: string;
  contractTokenId?: string;
  tokenId?: string;
  contractName?: string;
  ercType?: string;
  amount?: string;
  owner: string;
  tokenUri: string | null;
  contentType: string | null;
  contentUri: string | null;
  imageUri: string | null;
  nftscanUri: string | null;
  name?: string;
  description?: string;
  attributes?: Traits[];
  mintPrice?: number;
  latestTradePrice?: number;
  latestTradeSymbol?: string;
  collection: {
    contractName?: string;
    logoUrl?: string;
    floorPrice?: number;
  };
  image: {
    source: string;
    thumbnail: string;
  };
};

export type NFTScanNFTsResp = {
  success?: boolean;
  data: Collection[];
};
