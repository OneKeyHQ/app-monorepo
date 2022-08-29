import { NETWORK_ID_EVM_ETH } from '../constants';

export const NFTChainMap: Record<string, string> = {
  [NETWORK_ID_EVM_ETH]: 'eth',
  'evm--10': 'optimism',
  'evm--56': 'bsc',
  'evm--137': 'polygon',
  'evm--42161': 'arbitrum',
  'sol--101': 'sol',
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
