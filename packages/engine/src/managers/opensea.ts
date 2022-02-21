/* eslint-disable @typescript-eslint/naming-convention, camelcase, @typescript-eslint/no-unsafe-member-access */
import axios from 'axios';
import camelcaseKeys from 'camelcase-keys';
import qs from 'qs';

import { Asset, Collectible, OpenSeaAssetsResp, Trait } from '../types/opensea';

enum ERC20ChainIdMap {
  ETH = 1,
  BSC = 56,
  OEC = 65,
  xDai = 100,
  HECO = 128,
  POLYGON = 137,
}

const ASSETS_NETWORKS = {
  [ERC20ChainIdMap.ETH]: 'https://defi.onekey.so/api/v1/assets',
  4: 'https://rinkeby-api.opensea.io/api/v1/assets',
} as const;

export const getUserAssets = async ({
  account,
  chainId = ERC20ChainIdMap.ETH,
  collection,
  limit = 20,
  offset = 0,
}: {
  account: string;
  chainId?: number;
  collection?: string;
  limit?: number;
  offset?: number;
}): Promise<Collectible[]> => {
  const apiUrl = ASSETS_NETWORKS[chainId as keyof typeof ASSETS_NETWORKS];
  if (!apiUrl) {
    throw new Error(`Can not get nft assets from current network ${chainId}`);
  }

  const params = {
    owner: account,
    collection,
    limit,
    offset,
  };
  const url = `${apiUrl}?${qs.stringify(params)}`;
  const result = await axios.get<OpenSeaAssetsResp>(url);
  const res = result.data ?? {};
  if (result.status !== 200 || res.code !== 200) {
    throw new Error(res.message);
  }
  const { assets } = res.data;

  const collectibles = new Map<string, Collectible>();

  for (const asset of assets) {
    const {
      chain,
      collection: {
        name: collectionName,
        slug,
        description,
        image_url,
        banner_image_url,
        large_image_url,
      },
      asset_contract: { address, schema_name: schemaName },
    } = asset;

    const normalizedAsset: Asset = {
      id: asset.id,
      name: asset.name,
      tokenId: asset.token_id,
      description: asset.description,
      imageUrl: asset.image_url,
      imageOriginalUrl: asset.image_original_url,
      imagePreviewUrl: asset.image_preview_url,
      imageThumbnailUrl: asset.image_thumbnail_url,
      // Link to opensea
      permalink: asset.permalink,
      traits: camelcaseKeys(asset.traits ?? [], {
        deep: true,
      }) as Trait[],
    };
    const collectible = collectibles.get(collectionName);
    if (collectible) {
      collectible.assets.push(normalizedAsset);
    } else {
      collectibles.set(collectionName, {
        id: collectionName,
        chain,
        contract: {
          address,
          schemaName,
        },
        collection: {
          name: collectionName,
          slug,
          description,
          imageUrl: image_url,
          bannerImageUrl: banner_image_url,
          largeImageUrl: large_image_url,
        },
        assets: [normalizedAsset],
      });
    }
  }

  return Array.from(collectibles.values());
};
