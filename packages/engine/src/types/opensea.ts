/* eslint-disable camelcase */
export interface AssetContract {
  address: string;
  schema_name: string;
}

/**
 * Defines a AssetEvent type which contains details about an event that occurred
 */
export interface AssetEvent {
  // Details about the token used in the payment for this asset
  payment_token: {
    image_url?: string;
    eth_price?: string;
    usd_price?: string;
    name: string;
    symbol: string;
    decimals: number;
    address: string;
  } | null;
  total_price: string | null;
}

export interface OpenSeaTraits {
  display_type?: string;
  max_value?: number;
  trait_count?: number;
  trait_type: string;
  value: string;
}

export interface OpenSeaAsset {
  id: number | string;
  // The asset's given name
  name: string | null;
  // Description of the asset
  description?: string | null;
  // Image source url, storeed in opensea google static user content
  image_url?: string | null;
  image_preview_url?: string | null;
  image_thumbnail_url?: string | null;
  image_original_url?: string | null;
  permalink: string | null;
  token_id: string;
  collection: OpenSeaCollection;
  asset_contract: AssetContract;
  last_sale: AssetEvent | null;
  chain?: string | null;
  traits?: OpenSeaTraits[] | null;
}

export interface OpenSeaCollection {
  name: string;
  slug?: string;
  description?: string | null;
  image_url?: string | null;
  banner_image_url?: string | null;
  large_image_url?: string | null;
  created_date: string;
}

export interface OpenSeaAssetsResp {
  code: number;
  data: { assets: OpenSeaAsset[] };
  message?: string;
}

export interface Collection {
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
}

export type Collectible = {
  id: number | string;
  chain?: string | null;
  contract: {
    address: string;
    schemaName: string;
  };
  collection: Collection;
  assets: Asset[];
};

export type Asset = {
  id: number | string;
  name: string | null;
  tokenId: string | null;
  description?: string | null;
  imageUrl?: string | null;
  imageOriginalUrl?: string | null;
  imagePreviewUrl?: string | null;
  imageThumbnailUrl?: string | null;
  // Link to opensea
  permalink: string | null;
  traits?: Trait[] | null;
};

export type Trait = {
  traitType: string;
  value: string | number;
};
