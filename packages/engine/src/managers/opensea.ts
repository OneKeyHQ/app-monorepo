import axios from 'axios';
import camelcaseKeys from 'camelcase-keys';

import {
  CollectibleChainIdMap,
  OpenSeaAsset,
  OpenSeaAssetsResp,
} from '../types/opensea';

// TODO: Move into env
const OPENSEA_API_KEY = 'd7aa7bffcd224a318fef48e5de67f4d5';

export const isCollectibleSupportedChainId = (
  chainId?: number | string | null,
) =>
  !!chainId && Object.values(CollectibleChainIdMap).includes(Number(chainId));

const ASSETS_NETWORKS = {
  [CollectibleChainIdMap.ETH]: 'https://api.opensea.io/api/v1/assets',
  [CollectibleChainIdMap.Rinkeby]:
    'https://rinkeby-api.opensea.io/api/v1/assets',
  // [CollectibleChainIdMap.POLYGON]: 'https://api.opensea.io/api/v2/beta/assets',
} as const;

export const getUserAssets = async ({
  account,
  chainId = CollectibleChainIdMap.ETH,
  collection,
  limit = 20,
  offset = 0,
}: {
  account: string;
  chainId?: number | string | null;
  collection?: string;
  limit?: number;
  offset?: number;
}): Promise<OpenSeaAsset[]> => {
  if (!isCollectibleSupportedChainId(chainId)) {
    throw new Error(
      `ChainId ${
        chainId ?? ''
      } is not supported. Please use one of the following: '${Object.values(
        CollectibleChainIdMap,
      ).join(', ')}'`,
    );
  }
  const apiUrl = ASSETS_NETWORKS[chainId as keyof typeof ASSETS_NETWORKS];
  if (!apiUrl) {
    throw new Error(`Can not get nft assets of user '${account}'`);
  }

  const result = await axios.get<OpenSeaAssetsResp>(apiUrl, {
    params: {
      owner: account,
      collection,
      limit,
      offset,
    },
    headers: {
      'Accept': 'application/json',
      'X-Api-Key': OPENSEA_API_KEY,
    },
  });
  if (result.status !== 200) {
    throw new Error(result.statusText);
  }
  const res: OpenSeaAssetsResp = result.data ?? { assets: [] };
  return camelcaseKeys(res.assets, { deep: true });
};

const ASSET_NETWORKS = {
  [CollectibleChainIdMap.ETH]: 'https://api.opensea.io/api/v1/asset',
  [CollectibleChainIdMap.Rinkeby]:
    'https://rinkeby-api.opensea.io/api/v1/asset',
} as const;

export const getUserAsset = async ({
  contractAddress,
  tokenId,
  chainId = CollectibleChainIdMap.ETH,
}: {
  contractAddress: string;
  tokenId: string;
  chainId?: number | string | null;
}) => {
  if (!isCollectibleSupportedChainId(chainId)) {
    throw new Error(
      `ChainId ${
        chainId ?? ''
      } is not supported. Please use one of the following: '${Object.values(
        CollectibleChainIdMap,
      ).join(', ')}'`,
    );
  }
  const apiUrl = ASSET_NETWORKS[chainId as keyof typeof ASSETS_NETWORKS];
  if (!apiUrl) {
    throw new Error(
      `Can not retrieve specific nft asset of slug '${contractAddress}/${tokenId}'`,
    );
  }

  // https://api.opensea.io/api/v1/asset/{contractAddress}/{tokenId}
  const url = `${apiUrl}/${contractAddress}/${tokenId}`;
  const result = await axios.get<OpenSeaAsset>(url, {
    headers: {
      'Accept': 'application/json',
      'X-Api-Key': OPENSEA_API_KEY,
    },
  });
  if (result.status !== 200) {
    throw new Error(result.statusText);
  }
  const res: OpenSeaAsset = result.data ?? {};
  return camelcaseKeys(res, { deep: true });
};
