import axios from 'axios';
import camelcaseKeys from 'camelcase-keys';

import {
  NFTAsset,
  NFTChainMap,
  NFTScanNFTsResp,
  NFTSymbolMap,
} from '@onekeyhq/engine/src/types/nft';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { getFiatEndpoint } from '../endpoint';

export const isCollectibleSupportedChainId = (networkId?: string) => {
  if (!networkId) return false;
  if (NFTChainMap[networkId]) return true;
  return false;
};

export function getImageWithAsset(asset: NFTAsset) {
  const { nftscanUri, imageUri, contentType, contentUri } = asset;
  if (nftscanUri) {
    return nftscanUri;
  }
  if (imageUri) {
    if (
      (contentType?.startsWith('image') ||
        contentType?.startsWith('unknown')) &&
      !imageUri.endsWith('.mp4') &&
      !imageUri.endsWith('.mp3')
    ) {
      return imageUri;
    }
  }
  if (contentUri && imageUri && imageUri !== contentUri) {
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
    if (contentUri.startsWith('ipfs://')) {
      return contentUri.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
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

export const getUserNFTAssets = async (params: {
  accountId: string;
  networkId: string;
}): Promise<NFTScanNFTsResp> => {
  const { accountId, networkId } = params;
  // @ts-ignore
  const chain = NFTChainMap[networkId];
  const endpoint = getFiatEndpoint();
  const apiUrl = `${endpoint}/NFT/v2/list?address=${accountId}&chain=${chain}`;
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

export const getNFTSymbolPrice = async (networkId: string) => {
  const tokenId = NFTSymbolMap[networkId];

  const prices = await backgroundApiProxy.serviceToken.getPrices({
    networkId,
    tokenIds: [tokenId],
  });
  return prices[tokenId];
};
