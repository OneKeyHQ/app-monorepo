import axios from 'axios';
import camelcaseKeys from 'camelcase-keys';

import {
  ERCType,
  NFTChainMap,
  NFTScanAsset,
  NFTScanNFTsResp,
} from '@onekeyhq/engine/src/types/nftscan';

import { Network } from '../types/network';

// const HostURL = 'https://fiat.onekey.so';
const HostURL = 'http://192.168.2.6:9000';

export const isCollectibleSupportedChainId = (networkId?: string) => {
  if (!networkId) return false;
  if (NFTChainMap[networkId]) return true;
  return false;
};

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
  const apiUrl = `${HostURL}/NFT/v2/list?address=${address}&chain=${chain}&ercType=${ercType}`;
  const result = await axios.get<NFTScanNFTsResp>(apiUrl);
  return camelcaseKeys(result.data, { deep: true });
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
