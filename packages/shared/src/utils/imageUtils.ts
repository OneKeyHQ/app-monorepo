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

const range = (length: number) => [...Array(length).keys()];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const toGrayscale = (red: number, green: number, blue: number): number =>
  Math.round(0.299 * red + 0.587 * green + 0.114 * blue);

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

function isBase64Uri(uri: string): boolean {
  return /^data:image\/\w+;base64,/.test(uri);
}

function prefixBase64Uri(base64: string, mime: string): string {
  if (!base64) {
    return base64;
  }
  if (isBase64Uri(base64)) {
    return base64;
  }
  return `data:${mime || 'image/jpeg'};base64,${base64}`;
}

function stripBase64UriPrefix(base64Uri: string): string {
  return base64Uri.replace(/^data:image\/\w+;base64,/, '');
}

function convertToBlackAndWhiteImageBase64(
  colorImageBase64: string,
  mime: string,
): Promise<string> {
  if (platformEnv.isNative) {
    return global.$webembedApiProxy.imageUtils.convertToBlackAndWhiteImageBase64(
      colorImageBase64,
      mime,
    );
  }
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

      let whiteCount = 0;

      // TODO optimize this
      // https://github.com/trezor/homescreen-editor/blob/gh-pages/js/main.js#L234
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (avg > 128) {
          whiteCount += 4;
        }
        const bw = avg > 128 ? 255 : 0;
        // const bw = avg > 128 ? 0 : 255;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
      }

      // reverse color if white part is more than half
      if (whiteCount > data.length / 2) {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const bwImageBase64 = canvas.toDataURL(mime || 'image/jpeg');
      resolve(bwImageBase64);
    };

    img.onerror = reject;
    img.src = prefixBase64Uri(colorImageBase64, mime || 'image/jpeg');
  });
}

async function resizeImage(params: {
  uri: string;
  width: number;
  height: number;
  originW: number;
  originH: number;
  isMonochrome?: boolean;
}) {
  const { uri, width, height, originW, originH, isMonochrome } = params;
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

  if (isMonochrome && imageResult?.base64) {
    let bwBase64 = await convertToBlackAndWhiteImageBase64(
      imageResult.base64,
      'image/png', // image/jpeg will cause more noise on the image
    );
    bwBase64 = stripBase64UriPrefix(bwBase64);
    imageResult.base64 = bwBase64;
  }

  const buffer = Buffer.from(imageResult.base64 ?? '', 'base64');
  const hex = bufferUtils.bytesToHex(buffer);
  return { ...imageResult, hex };
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
    return prefixBase64Uri(base64, 'image/jpeg');
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

  if (isBase64Uri(uri)) {
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

function buildHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = (e) => reject(e);
    image.src = dataUrl;
  });
}

function htmlImageToCanvas({
  image,
  width,
  height,
}: {
  image: HTMLImageElement;
  width: number;
  height: number;
}) {
  const canvas = document.createElement('canvas');
  canvas.height = height;
  canvas.width = width;

  const ctx = canvas.getContext('2d');
  if (ctx == null) {
    throw new Error('2D context is null');
  }

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0);

  return { canvas, ctx };
}

function canvasImageDataToBitmap({
  imageData,
  width,
  height,
}: {
  imageData: ImageData;
  width: number;
  height: number;
}) {
  const homescreen = range(height)
    .map((j) =>
      range(width / 8)
        .map((i) => {
          const bytestr = range(8)
            .map((k) => (j * width + i * 8 + k) * 4)
            .map((index) => (imageData.data[index] === 0 ? '0' : '1'))
            .join('');

          return String.fromCharCode(Number.parseInt(bytestr, 2));
        })
        .join(''),
    )
    .join('');
  const hex = homescreen
    .split('')
    .map((letter) => letter.charCodeAt(0))
    // eslint-disable-next-line no-bitwise
    .map((charCode) => charCode & 0xff)
    .map((charCode) => charCode.toString(16))
    .map((chr) => (chr.length < 2 ? `0${chr}` : chr))
    .join('');

  // if image is all white or all black, return empty string
  if (/^f+$/.test(hex) || /^0+$/.test(hex)) {
    return '';
  }

  return hex;
}

async function base64ImageToBitmap({
  base64,
  width,
  height,
}: {
  base64: string;
  width: number;
  height: number;
}): Promise<string> {
  if (platformEnv.isNative) {
    return global.$webembedApiProxy.imageUtils.base64ImageToBitmap({
      base64,
      width,
      height,
    });
  }

  const image = await buildHtmlImage(base64);
  const { canvas, ctx } = htmlImageToCanvas({ image, width, height });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return canvasImageDataToBitmap({ imageData, width, height });
}

export default {
  resizeImage,
  prefixBase64Uri,
  convertToBlackAndWhiteImageBase64,
  getUriFromRequiredImageSource,
  getBase64FromRequiredImageSource,
  getBase64FromImageUri,
  base64ImageToBitmap,
};
