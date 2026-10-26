import { SEARCH_KEY_MIN_LENGTH } from '../consts/walletConsts';
import { CoreSDKLoader } from '../hardware/instance';

import bufferUtils from './bufferUtils';
import deviceUtils from './deviceUtils';
import { isProtocolV2ProductType } from './hardwareDeviceTypes';

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
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp'].includes(
    normalizedMimeType ?? '',
  );
}

export function isCollectibleNftMediaSupportedOnDevice(
  deviceType: IDeviceType | undefined,
  mimeType?: string,
) {
  if (!deviceType) return false;
  return (
    !isProtocolV2ProductType(deviceType) ||
    isCollectibleNftImageMimeType(mimeType)
  );
}

export type INFTMediaKind = 'image' | 'video';

const VIDEO_MEDIA_EXTENSIONS = new Set([
  'mp4',
  'm4v',
  'webm',
  'mov',
  'ogv',
  'mkv',
]);

function getMediaUriExtension(uri: string) {
  const path = uri.split(/[?#]/)[0];
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);
  const dotIndex = lastSegment.lastIndexOf('.');
  return dotIndex >= 0 ? lastSegment.slice(dotIndex + 1).toLowerCase() : '';
}

export function isLikelyVideoNFTMediaUri(uri: string) {
  const trimmed = uri.trim();
  if (/^data:video\//i.test(trimmed)) {
    return true;
  }
  return VIDEO_MEDIA_EXTENSIONS.has(getMediaUriExtension(trimmed));
}

/**
 * NFT metadata only carries a media uri, never a content type. Most NFT media
 * are images, so probe the image renderer first unless the uri is explicitly
 * a video; each renderer's onError advances to the next candidate.
 */
export function getNFTMediaProbeOrder(uri?: string): INFTMediaKind[] {
  if (!uri?.trim()) {
    return [];
  }
  return isLikelyVideoNFTMediaUri(uri)
    ? ['video', 'image']
    : ['image', 'video'];
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
