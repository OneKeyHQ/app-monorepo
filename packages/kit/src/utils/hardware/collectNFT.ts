import { Buffer } from 'buffer';

import { bytesToHex } from '@noble/hashes/utils';
import { ResourceType } from '@onekeyfe/hd-transport';
import axios from 'axios';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { Image } from 'react-native';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import type { HomescreenItem } from './constants/homescreens';
import type { DeviceUploadResourceParams } from '@onekeyfe/hd-core';
import type { Action } from 'expo-image-manipulator';

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
  const response = await axios.get(image, {
    responseType: 'arraybuffer',
  });
  const buffer = Buffer.from(response.data, 'binary').toString('base64');
  return `data:${response.headers['content-type']};base64,${buffer}`;
};

function getOriginX(
  originW: number,
  originH: number,
  scaleW: number,
  scaleH: number,
) {
  const width = Math.ceil((scaleH / originH) * originW);
  if (width <= scaleW) {
    return null;
  }
  const originX = Math.ceil(Math.ceil(width / 2) - Math.ceil(scaleW / 2));
  return originX;
}

export const compressHomescreen = async (
  uri: string,
  width: number,
  height: number,
  originW: number,
  originH: number,
) => {
  if (!uri) return;
  const actions: Action[] = [
    {
      resize: {
        width,
      },
    },
  ];
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
  const imageResult = await manipulateAsync(uri, actions, {
    compress: 0.9,
    format: SaveFormat.JPEG,
    base64: true,
  });

  const buffer = Buffer.from(imageResult.base64 ?? '', 'base64');
  const arrayBuffer = new Uint8Array(buffer);
  return {
    ...imageResult,
    arrayBuffer,
  };
};

export const collectToTouch = async (imageUrl: string) => {
  const { width, height } = await getImageSize(imageUrl);
  console.log('image size: ', { width, height });
  const base64 = await imageToBase64(imageUrl);
  console.log(base64);

  const data = await compressHomescreen(base64, 480, 800, width, height);
  console.log(data);
};
