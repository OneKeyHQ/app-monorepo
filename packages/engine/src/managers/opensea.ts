import axios from 'axios';
import { OpenSeaAsset } from 'opensea-js/lib/types';

const OPENSEA_API_KEY = '9254ce052d7b49d8972757591909bda6';

const config = {
  headers: { 'X-API-KEY': OPENSEA_API_KEY, Accept: 'application/json' },
};

type AssetList = { assets: OpenSeaAsset[]; estimatedCount: number };

function getAssets(
  owner: string,
  offset = 0,
  limit = 50,
  assetContractAddress?: string,
): Promise<AssetList> {
  let request = `https://api.opensea.io/api/v1/assets?offset=${offset}&limit=${limit}&`;

  request += `owner=${owner}`;

  if (assetContractAddress) {
    request += `asset_contract_address=${assetContractAddress}&`;
  }

  return axios
    .get<AssetList>(request, config)
    .then((response) => response.data);
}

function getAssetDetail(
  assetContractAddress: string,
  tokenId: string,
): Promise<OpenSeaAsset> {
  const request = `https://api.opensea.io/api/v1/asset/${assetContractAddress}/${tokenId}`;

  return axios
    .get<OpenSeaAsset>(request, config)
    .then((response) => response.data);
}

export { getAssets, getAssetDetail };
export type { OpenSeaAsset as asset } from 'opensea-js/lib/types';
