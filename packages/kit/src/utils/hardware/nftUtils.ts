import { Buffer } from 'buffer';

import { bytesToHex } from '@noble/hashes/utils';
import { ResourceType } from '@onekeyfe/hd-transport';
import axios from 'axios';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { Image } from 'react-native';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { formatBytes } from './homescreens';

import type {
  DeviceUploadResourceParams,
  IDeviceType,
} from '@onekeyfe/hd-core';
import type { Action } from 'expo-image-manipulator';

export type NFTMetaData = {
  header: string;
  subheader: string;
  network: string;
  owner: string;
};

export type DeviceInfo = {
  deviceType?: IDeviceType | string;
};

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
    const response = await axios.get(image, {
      responseType: 'arraybuffer',
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;',
      },
    });
    const buffer = Buffer.from(response.data, 'binary').toString('base64');
    return `data:${response.headers['content-type']};base64,${buffer}`;
  } catch {
    // fallback to download image by backend service
    return axios
      .post<string>(`${getFiatEndpoint()}/image/img2base64`, {
        url: image,
      })
      .then((i) => i.data);
  }
};

function getOriginX(
  originW: number,
  originH: number,
  scaleW: number,
  scaleH: number,
) {
  const width = Math.ceil((scaleH / originH) * originW);
  debugLogger.hardwareSDK.info(`image true width: `, width);
  debugLogger.hardwareSDK.info(`image should width: `, scaleW);
  debugLogger.hardwareSDK.info(`image true height: `, scaleH);
  if (width <= scaleW) {
    return null;
  }
  const originX = Math.ceil(Math.ceil(width / 2) - Math.ceil(scaleW / 2));
  debugLogger.hardwareSDK.info(`originX: `, originX);
  debugLogger.hardwareSDK.info(
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
  debugLogger.hardwareSDK.info(`image true height: `, height);
  debugLogger.hardwareSDK.info(`image should height: `, scaleH);
  debugLogger.hardwareSDK.info(`image true width: `, scaleW);
  if (height <= scaleH) {
    return null;
  }
  const originY = Math.ceil(Math.ceil(height / 2) - Math.ceil(scaleH / 2));
  debugLogger.hardwareSDK.info(`originY: `, originY);
  debugLogger.hardwareSDK.info(
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
  debugLogger.hardwareSDK.info(
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

  debugLogger.hardwareSDK.info('imageResult ====> : ', imageResult);

  const buffer = Buffer.from(imageResult.base64 ?? '', 'base64');
  const arrayBuffer = new Uint8Array(buffer);
  return {
    ...imageResult,
    arrayBuffer,
  };
};

export const generateUploadNFTParams = async (
  imageUri: string,
  metadata: NFTMetaData,
  deviceInfo: DeviceInfo,
) => {
  const { deviceType } = deviceInfo;
  const { width, height } = await getImageSize(imageUri);
  debugLogger.hardwareSDK.info('image size: ', { width, height });
  const base64 = await imageToBase64(imageUri);
  debugLogger.hardwareSDK.info(base64);
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

  debugLogger.hardwareSDK.info(
    'nft data byte length: ',
    formatBytes(data?.arrayBuffer?.byteLength ?? 0, 3),
  );
  debugLogger.hardwareSDK.info(
    'nft thumbnail byte length: ',
    formatBytes(zoomData?.arrayBuffer?.byteLength ?? 0, 3),
  );

  const metaData = { ...metadata };
  let metadataBuf = Buffer.from(JSON.stringify(metaData));
  if (metadataBuf.length > 1024 * 2) {
    debugLogger.hardwareSDK.info(
      'nft metadata overload 2kb, will ignore subheader: ',
      metadataBuf.length,
    );
    metaData.subheader = '';
    metadataBuf = Buffer.from(JSON.stringify(metaData));
  }
  const nftMetaData = bytesToHex(metadataBuf);

  const params: DeviceUploadResourceParams = {
    resType: ResourceType.Nft,
    suffix: 'jpg',
    dataHex: bytesToHex(data?.arrayBuffer as Uint8Array),
    thumbnailDataHex: bytesToHex(zoomData?.arrayBuffer as Uint8Array),
    nftMetaData,
  };

  return params;
};
