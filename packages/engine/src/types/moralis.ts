export const MoralisChainMap: Record<string, string> = {
  'evm--1': 'eth',
  'evm--56': 'bsc',
  'evm--137': 'polygon',
};

export type Traits = {
  traitType: string;
  value: string;
};

export type MoralisMetadata = {
  name?: string | null;
  title?: string | null;
  image?: string | null;
  attributes?: Traits[] | null;
  animationUrl?: string | null;
  description?: string | null;
};

export type CloudinaryObject = {
  assetId: string;
  folder: string;
  format: string;
  width: number;
  height: number;
  publicId: string;
  resourceType: string;
  secureUrl: string;
  eager?: { url: string; secureUrl: string }[];
};

export type MoralisNFT = {
  tokenAddress: string;
  tokenId: string;
  amount: string | null;
  ownerOf: string | null;
  tokenHash: string;
  blockNumberMinted: string | null;
  blockNumber: string | null;
  contractType: string | null;
  name?: string | null;
  symbol: string | null;
  tokenUri: string | null;
  metadata: string | null;

  assetName?: string | null;
  description?: string | null;
  attributes?: Traits[] | null;
  imageUrl?: CloudinaryObject;
  animationUrl?: CloudinaryObject;
  chain: string;
};

export type MoralisNFTsResp = {
  success?: boolean;
  message?: string;
  cursor?: string | null;
  chain: string;
  page?: number | null;
  pageSize?: number | null;
  result: MoralisNFT[];
};

export type Collection = {
  name?: string | null;
};

export type Collectible = {
  id: number | string;
  chain?: string | null;
  collection: Collection;
  assets: MoralisNFT[];
};
