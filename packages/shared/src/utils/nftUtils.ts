import { ResourceType } from '@onekeyfe/hd-transport';
import axios from 'axios';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { Image } from 'react-native';

import { SEARCH_KEY_MIN_LENGTH } from '../consts/walletConsts';

import bufferUtils from './bufferUtils';

import type { IAccountNFT, INFTMetaData } from '../../types/nft';
import type {
  DeviceUploadResourceParams,
  IDeviceType,
} from '@onekeyfe/hd-core';
import type { Action } from 'expo-image-manipulator';

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

const getImageSize: (
  imageUrl: string,
) => Promise<{ width: number; height: number }> = (imageUrl) =>
  new Promise((resolve, reject) => {
    Image.getSize(
      imageUrl,
      (width: number, height: number) => {
        resolve({ width, height });
      },
      (error: any) => reject(error),
    );
  });

/**
 *	use axios to convert image url to base64
 * @param image
 */
export const imageToBase64 = async (image: string) => {
  try {
    const response = await axios.get<{
      data: string;
    }>(image, {
      responseType: 'arraybuffer',
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;',
      },
    });
    const buffer = Buffer.from(response.data.data, 'binary').toString('base64');
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `data:${response.headers['content-type']};base64,${buffer}`;
  } catch {
    // TODO fallback to download image by backend service
    return '';
  }
};

function getOriginX(
  originW: number,
  originH: number,
  scaleW: number,
  scaleH: number,
) {
  const width = Math.ceil((scaleH / originH) * originW);
  console.log(`image true width: `, width);
  console.log(`image should width: `, scaleW);
  console.log(`image true height: `, scaleH);
  if (width <= scaleW) {
    return null;
  }
  const originX = Math.ceil(Math.ceil(width / 2) - Math.ceil(scaleW / 2));
  console.log(`originX: `, originX);
  console.log(
    `crop size: height: ${scaleH}, width: ${scaleW}, originX: ${originX}, originY: 0`,
  );
  return originX;
}

function getOriginY(
  originW: number,
  originH: number,
  scaleW: number,
  scaleH: number,
) {
  const height = Math.ceil((scaleW / originW) * originH);
  console.log(`image true height: `, height);
  console.log(`image should height: `, scaleH);
  console.log(`image true width: `, scaleW);
  if (height <= scaleH) {
    return null;
  }
  const originY = Math.ceil(Math.ceil(height / 2) - Math.ceil(scaleH / 2));
  console.log(`originY: `, originY);
  console.log(
    `crop size: height: ${scaleH}, width: ${scaleW}, , originX: 0, originY: ${originY}`,
  );
  return originY;
}

export const compressNFT = async (
  uri: string,
  width: number,
  height: number,
  originW: number,
  originH: number,
  isThumbnail: boolean,
) => {
  if (!uri) return;
  console.log(
    `width: ${width}, height: ${height}, originW: ${originW}, originH: ${originH}`,
  );
  const aspectRatioLonger = originW > originH;
  const aspectRatioEqueal = originW === originH;

  const actions: Action[] = [];
  if (!isThumbnail) {
    actions.push({
      resize: { width },
    });
  } else {
    actions.push({
      resize: {
        width: aspectRatioLonger ? undefined : width,
        height: aspectRatioLonger ? height : undefined,
      },
    });
  }

  if (isThumbnail && !aspectRatioEqueal) {
    if (aspectRatioLonger) {
      const originX = getOriginX(originW, originH, width, height);
      if (originX !== null) {
        actions.push({
          crop: {
            height,
            width,
            originX,
            originY: 0,
          },
        });
      }
    } else {
      const originY = getOriginY(originW, originH, width, height);
      if (originY !== null) {
        actions.push({
          crop: {
            height,
            width,
            originX: 0,
            originY,
          },
        });
      }
    }
  }

  const imageResult = await manipulateAsync(uri, actions, {
    compress: 0.9,
    format: SaveFormat.JPEG,
    base64: true,
  });

  console.log('imageResult ====> : ', imageResult);

  const buffer = Buffer.from(imageResult.base64 ?? '', 'base64');
  const arrayBuffer = new Uint8Array(buffer);
  return {
    ...imageResult,
    arrayBuffer,
  };
};

export async function generateUploadNFTParams({
  imageUri,
  metadata,
  deviceType,
}: {
  imageUri: string;
  metadata: INFTMetaData;
  deviceType: IDeviceType;
}) {
  const { width, height } = await getImageSize(imageUri);
  console.log('image size: ', { width, height });
  const base64 = await imageToBase64(imageUri);
  console.log(base64);
  const data = await compressNFT(base64, 480, 800, width, height, false);

  const zoomWidth = deviceType === 'touch' ? 238 : 226;
  const zoomHeight = deviceType === 'touch' ? 238 : 226;
  const zoomData = await compressNFT(
    base64,
    zoomWidth,
    zoomHeight,
    width,
    height,
    true,
  );

  if (!data?.arrayBuffer && !zoomData?.arrayBuffer) return;

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
    dataHex: bufferUtils.bytesToHex(data?.arrayBuffer as Uint8Array),
    thumbnailDataHex: bufferUtils.bytesToHex(
      zoomData?.arrayBuffer as Uint8Array,
    ),
    nftMetaData,
  };

  return params;
}
