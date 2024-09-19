import {
  downloadAsync as RNDownloadAsync,
  readAsStringAsync as RNReadAsStringAsync,
  documentDirectory,
} from 'expo-file-system';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { isArray, isNumber } from 'lodash';
import { Image as RNImage } from 'react-native';

import platformEnv from '../platformEnv';

import bufferUtils from './bufferUtils';

import type {
  Action as ExpoImageManipulatorAction,
  ImageResult,
} from 'expo-image-manipulator';
import type { ImageSourcePropType } from 'react-native';

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

async function resizeImage(params: {
  uri: string;
  width: number;
  height: number;
  originW: number;
  originH: number;
}) {
  const { uri, width, height, originW, originH } = params;
  if (!uri) return;
  const actions: ExpoImageManipulatorAction[] = [
    // resize first
    {
      resize: {
        height,
      },
    },
  ];
  //   const originX = getOriginX(originW, originH, width, height);
  const originX = null;
  if (originX !== null) {
    actions.push({
      // crop later if needed
      crop: {
        height,
        width,
        originX: 0,
        originY: 0,
      },
    });
  }
  const imageResult: ImageResult = await manipulateAsync(uri, actions, {
    compress: 0.9,
    format: SaveFormat.JPEG,
    base64: true,
  });

  const buffer = Buffer.from(imageResult.base64 ?? '', 'base64');
  const hex = bufferUtils.bytesToHex(buffer);
  return { ...imageResult, hex };
}

function convertToBlackAndWhite(
  colorImageBase64: string,
  mime: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('ctx is null'));
        return;
      }
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const bw = avg > 128 ? 255 : 0;
        // const bw = avg > 128 ? 0 : 255;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
      }

      ctx.putImageData(imageData, 0, 0);

      const bwImageBase64 = canvas.toDataURL(mime || 'image/jpeg');
      resolve(bwImageBase64);
    };

    img.onerror = reject;
    img.src = colorImageBase64;
  });
}

async function getBase64FromImageUriNative(
  uri: string,
): Promise<string | undefined> {
  try {
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      // eslint-disable-next-line no-param-reassign
      ({ uri } = await RNDownloadAsync(
        uri,
        `${documentDirectory || ''}tmp-get-rn-image-base64.jpg`,
      ));
    }
    const base64 = await RNReadAsStringAsync(uri, {
      encoding: 'base64',
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    return undefined;
  }
}

async function getBase64FromImageUriWeb(
  uri: string,
): Promise<string | undefined> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const readerResult = reader.result as string;
        // readerResult is base64 string with mime prefix
        resolve(readerResult);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    return undefined;
  }
}

async function getBase64FromImageUri(
  uri: string | undefined,
): Promise<string | undefined> {
  if (!uri) {
    return undefined;
  }

  if (/^data:image\/\w+;base64,/.test(uri)) {
    return uri;
  }

  if (platformEnv.isNative) {
    return getBase64FromImageUriNative(uri);
  }
  return getBase64FromImageUriWeb(uri);
}

async function getUriFromRequiredImageSource(
  source: ImageSourcePropType | undefined,
): Promise<string | undefined> {
  if (platformEnv.isNative && source) {
    const resolvedAssetSource = RNImage.resolveAssetSource(source);
    const uri = resolvedAssetSource.uri;
    return uri;
  }
  if (typeof source === 'string') {
    return source;
  }
  if (isArray(source)) {
    return undefined;
  }
  if (isNumber(source)) {
    return undefined;
  }
  return source?.uri;
}

async function getBase64FromRequiredImageSource(
  source: ImageSourcePropType | undefined,
): Promise<string | undefined> {
  const uri = await getUriFromRequiredImageSource(source);
  return getBase64FromImageUri(uri);
}

export default {
  resizeImage,
  convertToBlackAndWhite,
  getUriFromRequiredImageSource,
  getBase64FromRequiredImageSource,
  getBase64FromImageUri,
};
