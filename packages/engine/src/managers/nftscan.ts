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
const fiatServiceURL = 'http://127.0.0.1:9000';
// const uploadHost = 'http://192.168.5.182:9000';
const testFiatServiceURL = 'https://fiat.onekeytest.com';

export const isCollectibleSupportedChainId = (networkId?: string) => {
  if (!networkId) return false;
  if (NFTChainMap[networkId]) return true;
  return false;
};

function parseContentUri(uri: string) {
  if (
    uri.startsWith('data:image/svg+xml;base64') ||
    uri.startsWith('https://')
  ) {
    return uri;
  }
  if (uri.toLocaleLowerCase().startsWith('qm')) {
    return `https://cloudflare-ipfs.com/ipfs/${uri}`;
  }
  if (uri.startsWith('ar://')) {
    return `https://arweave.net/${uri.replace('ar://', '')}`;
  }
}

const s3Host = 'https://dev.onekey-asset.com';
export function s3SourceUri(
  contractAddress: string,
  tokenId: string,
  thumbnail?: boolean,
) {
  return `${s3Host}/${contractAddress}/${tokenId}/${
    thumbnail ? 'thumbnail' : 'source'
  }`;
}

export function getImageWithAsset(asset: NFTScanAsset) {
  const { nftscanUri, imageUri } = asset;
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

export function getContentWithAsset(asset: NFTScanAsset) {
  const { contentUri } = asset;
  if (contentUri) {
    const parseUri = parseContentUri(contentUri);
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

type UploadImagePayload =
  | {
      source: string;
      thumbnail: string;
    }
  | undefined;
export const syncImage = async (params: {
  contractAddress: string;
  tokenId: string;
  imageURI: string;
}): Promise<UploadImagePayload> => {
  const apiUrl = `${testFiatServiceURL}/NFT/sync`;
  const data = await axios
    .post<UploadImagePayload>(apiUrl, params)
    .then((resp) => resp.data)
    .catch(() => undefined);
  return data;
};
