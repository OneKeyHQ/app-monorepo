import axios from 'axios';
import camelcaseKeys from 'camelcase-keys';

import {
  ERCType,
  NFTChainMap,
  NFTScanAsset,
  NFTScanNFTsResp,
} from '@onekeyhq/engine/src/types/nftscan';

import { Network } from '../types/network';

// const fiatServiceURL = 'https://fiat.onekey.so';
const fiatServiceURL = 'http://192.168.2.6:9000';

export const isCollectibleSupportedChainId = (networkId?: string) => {
  if (!networkId) return false;
  if (NFTChainMap[networkId]) return true;
  return false;
};

const IMAGE_CONTENTTYPE = [
  'image/jpeg',
  'image/gif',
  'image/png',
  'image/jpg',
  'image/svg',
  'unknown',
];
const VIDEO_CONTENTTYPE = ['image/mp4'];
const AUDIO_CONTENTTYPE = ['image/wav', 'image/mpeg'];

function isSupportContentType(
  contentType: string | null,
  supportTypes: string[],
) {
  if (contentType === null) {
    return false;
  }
  return supportTypes.includes(contentType);
}

function parseContentUri(uri: string) {
  if (
    uri.startsWith('data:image/svg+xml;base64') ||
    uri.startsWith('https://')
  ) {
    return uri;
  }
  if (uri.toUpperCase().startsWith('QM')) {
    return `https://gateway.moralisipfs.com/ipfs/${uri}`;
  }
  if (uri.startsWith('ar://')) {
    return `https://arweave.net/${uri.replace('ar://', '')}`;
  }
}
// dev.onekey-asset.com/0xb4cfb411252a80b35b6b73737ff11f510d0f5928/0x0cfb5d82be2b949e8fa73a656df91821e2ad99fd/0x0000000000000000000000000000000000000000000000000000000100001f2f

const s3Host = 'https://dev.onekey-asset.com';
export function s3SourceUri(
  contractAddress: string,
  tokenId: string,
  thumble?: boolean,
) {
  return `${s3Host}/${contractAddress}/${tokenId}`;
}

export function getImageWithAsset(asset: NFTScanAsset) {
  const { nftscanUri, imageUri, contentType } = asset;
  if (nftscanUri) {
    return nftscanUri;
  }
  if (imageUri) {
    const parseUri = parseContentUri(imageUri);
    if (parseUri) {
      return parseUri;
    }
  }
}

export function getNFTScanChainWithNetWork(network: Network): string {
  return NFTChainMap[network.id] ?? '';
}

export const parseNFTMetaData = (asset: NFTScanAsset) => {
  if (asset.metadataJson) {
    const jsonData = JSON.parse(asset.metadataJson);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    asset.name = asset.name ?? jsonData.name ?? jsonData.title;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    asset.description = jsonData.description;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    asset.attributes = jsonData.attributes;
  }
  return camelcaseKeys(asset, { deep: true });
};

export const getUserAssetsWithERCType = async (params: {
  address: string;
  network: Network;
  ercType: ERCType;
}): Promise<NFTScanNFTsResp> => {
  const { address, network, ercType } = params;
  const chain = getNFTScanChainWithNetWork(network);
  const apiUrl = `${fiatServiceURL}/NFT/v2/list?address=${address}&chain=${chain}&ercType=${ercType}`;
  const data = await axios
    .get<NFTScanNFTsResp>(apiUrl)
    .then((resp) => resp.data)
    .catch(() => ({ data: [] }));
  return camelcaseKeys(data, { deep: true });
};

export const getAllNFTs = async (params: {
  address?: string | null;
  network?: Network | null;
}): Promise<NFTScanNFTsResp> => {
  const { address, network } = params;
  const hasNoParams = !address || !network?.id;
  if (hasNoParams) {
    return { code: 200, data: [] };
  }
  const [{ data: erc1155Data }, { data: erc721Data }] = await Promise.all([
    getUserAssetsWithERCType({ address, network, ercType: 'erc1155' }),
    getUserAssetsWithERCType({ address, network, ercType: 'erc721' }),
  ]);
  return { code: 200, data: [...(erc721Data ?? []), ...(erc1155Data ?? [])] };
};

export const syncImage = async (params: {
  contractAddress: string;
  tokenId: string;
  imageURI: string;
}): Promise<string> => {
  const { contractAddress, tokenId, imageURI } = params;
  const apiUrl = `${fiatServiceURL}/NFT/sync?contractAddress=${contractAddress}&tokenId=${tokenId}&imageURI=${imageURI}`;
  console.log('uploadImage contractAddress= ', contractAddress);
  console.log('uploadImage tokenId= ', tokenId);
  console.log('uploadImage imageURI= ', imageURI);

  const data = await axios
    .get<string>(apiUrl)
    .then((resp) => resp.data)
    .catch(() => '');
  return data;
};
