import axios from 'axios';
import camelcaseKeys from 'camelcase-keys';

import {
  NFTAsset,
  NFTChainMap,
  NFTScanNFTsResp,
} from '@onekeyhq/engine/src/types/nft';

import { getFiatEndpoint } from '../endpoint';
import { Network } from '../types/network';

export const isCollectibleSupportedChainId = (networkId?: string) => {
  if (!networkId) return false;
  if (NFTChainMap[networkId]) return true;
  return false;
};

export function getImageWithAsset(asset: NFTAsset) {
  const { nftscanUri, imageUri, contentType } = asset;
  if (nftscanUri) {
    return nftscanUri;
  }
  if (
    imageUri &&
    !contentType?.startsWith('video') &&
    !contentType?.startsWith('audio') &&
    !imageUri.endsWith('.mp4') &&
    !imageUri.endsWith('.mp3')
  ) {
    return imageUri;
  }
}

export function getHttpImageWithAsset(asset: NFTAsset) {
  const { imageUri, nftscanUri } = asset;
  if (nftscanUri) {
    return nftscanUri;
  }
  if (imageUri) {
    if (
      imageUri.toLowerCase().startsWith('qm') ||
      imageUri.toLowerCase().startsWith('ba')
    ) {
      return `https://cloudflare-ipfs.com/ipfs/${imageUri}`;
    }
    if (imageUri.startsWith('ar://')) {
      return `https://arweave.net/${imageUri.replace('ar://', '')}`;
    }
    return imageUri;
  }
}

export function getContentWithAsset(asset: NFTAsset) {
  const { contentUri } = asset;
  if (contentUri) {
    if (
      contentUri.toLowerCase().startsWith('qm') ||
      contentUri.toLowerCase().startsWith('ba')
    ) {
      return `https://cloudflare-ipfs.com/ipfs/${contentUri}`;
    }
    if (contentUri.startsWith('ar://')) {
      return `https://arweave.net/${contentUri.replace('ar://', '')}`;
    }
    if (contentUri.startsWith('<svg')) {
      const base64Svg = Buffer.from(contentUri, 'utf-8').toString('base64');
      return `data:image/svg+xml;base64,${base64Svg}`;
    }
    return contentUri;
  }
}

export function getNFTScanChainWithNetWork(network: Network): string {
  return NFTChainMap[network.id] ?? '';
}

export const getUserNFTAssets = async (params: {
  address?: string | null;
  network?: Network | null;
}): Promise<NFTScanNFTsResp> => {
  const { address, network } = params;
  const hasNoParams = !address || !network?.id;
  if (hasNoParams) {
    return { success: true, data: [] };
  }
  const chain = getNFTScanChainWithNetWork(network);
  const endpoint = getFiatEndpoint();

  const apiUrl = `${endpoint}/NFT/v2/list?address=${address}&chain=${chain}`;
  const data = await axios
    .get<NFTScanNFTsResp>(apiUrl)
    .then((resp) => resp.data)
    .catch(() => ({ data: [] }));
  return camelcaseKeys(data, { deep: true });
};

export const syncImage = async (params: {
  contractAddress?: string;
  tokenId: string;
  imageURI: string;
}) => {
  const endpoint = getFiatEndpoint();
  const apiUrl = `${endpoint}/NFT/sync`;
  const data = await axios
    .post(apiUrl, params, { timeout: 3 * 60 * 1000 })
    .then(() => true)
    .catch(() => false);
  return data;
};
