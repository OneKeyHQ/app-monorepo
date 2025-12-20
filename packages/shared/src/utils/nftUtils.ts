import { ResourceType } from '@onekeyfe/hd-transport';

import { SEARCH_KEY_MIN_LENGTH } from '../consts/walletConsts';

import bufferUtils from './bufferUtils';

import type { IAccountNFT, INFTMetaData } from '../../types/nft';
import type { DeviceUploadResourceParams } from '@onekeyfe/hd-core';

export function getFilteredNftsBySearchKey({
  nfts,
  searchKey,
}: {
  nfts: IAccountNFT[];
  searchKey: string;
}) {
  if (!searchKey || searchKey.length < SEARCH_KEY_MIN_LENGTH) {
    return nfts;
  }

  // eslint-disable-next-line no-param-reassign
  searchKey = searchKey.trim().toLowerCase();

  const filteredNfts = nfts.filter(
    (nft) =>
      nft.collectionAddress?.toLowerCase() === searchKey ||
      nft.collectionName?.toLowerCase().includes(searchKey) ||
      nft.metadata?.name?.toLowerCase().includes(searchKey),
  );

  return filteredNfts;
}

export async function generateUploadNFTParams({
  screenHex,
  thumbnailHex,
  blurScreenHex,
  metadata,
}: {
  screenHex: string;
  thumbnailHex: string;
  blurScreenHex: string;
  metadata: INFTMetaData;
}) {
  const metaData = { ...metadata } as INFTMetaData;
  let metadataBuf = Buffer.from(JSON.stringify(metaData));
  if (metadataBuf.length > 1024 * 2) {
    console.log(
      'nft metadata overload 2kb, will ignore subheader: ',
      metadataBuf.length,
    );
    metaData.subheader = '';
    metadataBuf = Buffer.from(JSON.stringify(metaData));
  }
  const nftMetaData = bufferUtils.bytesToHex(metadataBuf);

  const params: DeviceUploadResourceParams = {
    resType: ResourceType.Nft,
    suffix: 'jpg',
    dataHex: screenHex,
    thumbnailDataHex: thumbnailHex,
    blurDataHex: blurScreenHex,
    nftMetaData,
  };

  return params;
}
