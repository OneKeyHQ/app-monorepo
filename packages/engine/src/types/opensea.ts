export enum CollectibleChainIdMap {
  ETH = 1,
  Rinkeby = 4,
  // Uncomment it when is supported
  // BSC = 56,
  // OEC = 65,
  // xDai = 100,
  // HECO = 128,
  // POLYGON = 137,
}

export type AssetContract = {
  address: string;
  schemaName: string;
};

/**
 * Defines a AssetEvent type which contains details about an event that occurred
 */
export type AssetEvent = {
  // Details about the token used in the payment for this asset
  paymentToken: {
    imageUrl?: string;
    ethPrice?: string;
    usdPrice?: string;
    name: string;
    symbol: string;
    decimals: number;
    address: string;
  } | null;
  totalPrice: string | null;
};

export type OpenSeaTraits = {
  displayType?: string;
  maxValue?: number;
  traitCount?: number;
  traitType: string;
  value: string;
};

export type OpenSeaAsset = {
  id: number | string;
  // The asset's given name
  name: string | null;
  // Description of the asset
  description?: string | null;
  // Image source url, storeed in opensea google static user content
  imageUrl?: string | null;
  imagePreviewUrl?: string | null;
  imageThumbnailUrl?: string | null;
  imageOriginalUrl?: string | null;
  permalink: string | null;
  tokenId: string;
  collection: Collection;
  assetContract: AssetContract;
  lastSale: AssetEvent | null;
  chain?: string | null;
  traits?: OpenSeaTraits[] | null;
  owner: {
    address: string;
    config?: string;
    profileImgUrl?: string;
    user: { username?: string | null };
  };
};

export type OpenSeaAssetsResp = {
  assets: OpenSeaAsset[];
};

export type Collection = {
  // Name of the collection
  name?: string | null;
  // Slug, used in URL
  slug?: string;
  // Description of the collection
  description?: string | null;
  // Image for the collection
  imageUrl?: string | null;
  // Banner Image for the collection
  bannerImageUrl?: string | null;
  // Image for the collection, large
  largeImageUrl?: string | null;
};

export type Collectible = {
  id: number | string;
  chain?: string | null;
  contract: {
    address: string;
    schemaName: string;
  };
  collection: Collection;
  assets: OpenSeaAsset[];
};
