import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

import bufferUtils from './bufferUtils';

import type {
  Action as ExpoImageManipulatorAction,
  ImageResult,
} from 'expo-image-manipulator';

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

export default {
  resizeImage,
};
