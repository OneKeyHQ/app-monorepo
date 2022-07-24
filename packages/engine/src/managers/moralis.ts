import axios from 'axios';
import camelcaseKeys from 'camelcase-keys';

import {
  CloudinaryObject,
  MoralisChainMap,
  MoralisNFT,
} from '@onekeyhq/engine/src/types/moralis';
import {
  cloudinaryImageWithPublidId,
  cloudinarySourceWithPublidId,
} from '@onekeyhq/kit/src/utils/imageUtils';

import { MoralisNFTsResp } from '../types/moralis';
import { Network } from '../types/network';

export const isCollectibleSupportedChainId = (networkId?: string) => {
  if (!networkId) return false;
  if (MoralisChainMap[networkId]) return true;
  return false;
};

export function getMoralisChainWithNetWork(network: Network): string {
  return MoralisChainMap[network.id] ?? '';
}

export function publicIdWithAsset(
  asset: MoralisNFT,
  type: 'image' | 'video',
): string {
  return `${asset.tokenAddress}-${asset.tokenId}-${asset.tokenHash}-${type}`;
}

export function getImageWithAsset(asset: MoralisNFT, size?: number): string {
  const object = asset.imageUrl ?? asset.animationUrl;
  if (object) {
    return cloudinaryImageWithPublidId(
      object?.publicId,
      object.resourceType,
      size,
    );
  }
  return '';
}

export function getSourceWithAsset(asset: MoralisNFT, size?: number): string {
  const object = asset.animationUrl ?? asset.imageUrl;
  if (object) {
    return cloudinarySourceWithPublidId(
      object?.publicId,
      object.resourceType,
      size,
    );
  }
  return '';
}

const HostURL = 'https://fiat.onekey.so';

export const getUserAssets = async (params: {
  address?: string | null;
  network?: Network | null;
  cursor?: string | null;
}): Promise<MoralisNFTsResp> => {
  const { address, network, cursor } = params;
  const hasNoParams = !address || !network?.id;
  if (hasNoParams) {
    return { chain: '', result: [] };
  }
  const chain = getMoralisChainWithNetWork(network);
  let apiUrl = `${HostURL}/NFT/list?address=${address}&chain=${chain}`;
  if (cursor) {
    apiUrl = `${apiUrl}&cursor=${cursor}&limit=50`;
  }
  const result = await axios.get<MoralisNFTsResp>(apiUrl);
  return camelcaseKeys(result.data, { deep: true });
};

export async function getAssetSources(
  publicId: string,
  resourceType: string,
): Promise<CloudinaryObject> {
  const apiUrl = `${HostURL}/NFT/image?publicId=${publicId}&type=${resourceType}`;
  const { data } = await axios.get<CloudinaryObject>(apiUrl);
  const result = camelcaseKeys(data, { deep: true });
  return result;
}

// export async function getMetaDataWithTokenUrl(
//   asset: MoralisNFT,
// ): Promise<MoralisMetadata> {
//   const url = asset.tokenUri;
//   if (!url) {
//     return {};
//   }
//   const prefix = 'data:application/json;utf8,';
//   if (url.startsWith(prefix)) {
//     const jsonString = url.substring(prefix.length, url.length);
//     return JSON.parse(jsonString) as MoralisMetadata;
//   }
//   if (url.startsWith('http')) {
//     const apiUrl = `${HostURL}/NFT/metadata?tokenUri=${url}`;

//     const { data } = await axios.get<MoralisMetadata>(apiUrl);
//     return camelcaseKeys(data, { deep: true });
//   }
//   return {};
// }
