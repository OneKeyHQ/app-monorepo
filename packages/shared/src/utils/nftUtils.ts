import { SEARCH_KEY_MIN_LENGTH } from '../consts/walletConsts';
import { CoreSDKLoader } from '../hardware/instance';

import bufferUtils from './bufferUtils';
import deviceUtils from './deviceUtils';

import type { IAccountNFT, INFTMetaData } from '../../types/nft';
import type {
  DeviceUploadResourceParams,
  IDeviceType,
} from '@onekeyfe/hd-core';

export function isCollectNFTDeviceCompatible(deviceType?: IDeviceType) {
  return Boolean(deviceType && deviceUtils.isTouchDevice(deviceType));
}

export function isCollectibleNftImageMimeType(mimeType?: string) {
  const normalizedMimeType = mimeType?.split(';')[0].trim().toLowerCase();
  return ['image/jpeg', 'image/png', 'image/bmp'].includes(
    normalizedMimeType ?? '',
  );
}

function truncateUtf8(value: string, maxBytes: number): string {
  let result = '';
  let byteLength = 0;
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, 'utf8');
    if (byteLength + characterBytes > maxBytes) break;
    result += character;
    byteLength += characterBytes;
  }
  return result;
}

export function generatePro2NftMetadata({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return {
    title: truncateUtf8(title, 63),
    subtitle: truncateUtf8(subtitle, 95),
  };
}

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
  const { ResourceType } = await CoreSDKLoader();
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
