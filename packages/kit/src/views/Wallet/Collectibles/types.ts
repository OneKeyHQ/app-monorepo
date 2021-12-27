export enum CollectibleView {
  Flat = 'Flat',
  Grid = 'Grid',
}

export type SelectedAsset = Asset & {
  chain?: string | null;
  contractAddress?: string | null;
};

export type Collectible = {
  id: number | string | null;
  chain?: string | null;
  collection: {
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
  contract: {
    address: string;
    schemaName: string;
  };
  assets: Asset[];
};

export type Asset = {
  id: number | string | null;
  name: string | null;
  tokenId: string;
  description?: string | null;
  imageUrl?: string | null;
  imageOriginalUrl?: string | null;
  imagePreviewUrl?: string | null;
  imageThumbnailUrl?: string | null;
  // Link to opensea
  permalink: string | null;
  traits?: Traits[] | null;
};

export type Traits = {
  traitType: string;
  value: string | number;
};
