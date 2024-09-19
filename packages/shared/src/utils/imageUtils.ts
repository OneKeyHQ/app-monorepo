import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { isArray, isNumber } from 'lodash';

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

function getImageWebUri(source: ImageSourcePropType | undefined) {
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

export default {
  resizeImage,
  convertToBlackAndWhite,
  getImageWebUri,
};
