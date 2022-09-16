import { OnekeyNetwork } from '../presets/networkIds';

export const NFTChainMap: Record<string, string> = {
  [OnekeyNetwork.eth]: 'eth',
  [OnekeyNetwork.optimism]: 'optimism',
  [OnekeyNetwork.bsc]: 'bsc',
  [OnekeyNetwork.polygon]: 'polygon',
  [OnekeyNetwork.arbitrum]: 'arbitrum',
  [OnekeyNetwork.sol]: 'sol',
};

export const NFTSymbolMap: Record<string, string> = {
  [OnekeyNetwork.eth]: 'ethereum',
  [OnekeyNetwork.optimism]: 'ethereum',
  [OnekeyNetwork.bsc]: 'binancecoin',
  [OnekeyNetwork.polygon]: 'weth',
  [OnekeyNetwork.arbitrum]: 'ethereum',
  [OnekeyNetwork.sol]: 'solana',
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
