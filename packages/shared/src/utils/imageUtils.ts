import { Asset } from 'expo-asset';
import {
  downloadAsync as ExpoFSDownloadAsync,
  readAsStringAsync as ExpoFSReadAsStringAsync,
  documentDirectory,
} from 'expo-file-system';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { isArray, isNil, isNumber, isObject, isString } from 'lodash';
import { Image as RNImage } from 'react-native';
import RNFS from 'react-native-fs';

import platformEnv from '../platformEnv';

import bufferUtils from './bufferUtils';

import type {
  Action as ExpoImageManipulatorAction,
  ImageResult,
} from 'expo-image-manipulator';
import type { ImageSourcePropType } from 'react-native';

type ICommonImageLogFn = (...args: string[]) => void;

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
    return globalThis.$webembedApiProxy.imageUtils.convertToBlackAndWhiteImageBase64(
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

async function getRNLocalImageBase64({
  nativeModuleId,
  uri,
  logFn,
}: {
  nativeModuleId?: number;
  uri: string;
  logFn?: ICommonImageLogFn;
}) {
  const errors: string[] = [];
  let downloadedUri: string | undefined | null;
  let downloadedUri1: string | undefined | null;
  let downloadedUri2: string | undefined | null;
  let base64a: string | undefined;
  let base64a1: string | undefined;
  let base64b: string | undefined;
  let base64c: string | undefined;
  let base64d: string | undefined;

  // **** use expo-file-system
  try {
    base64a = await ExpoFSReadAsStringAsync(uri, {
      encoding: 'base64',
    });
  } catch (error) {
    errors.push(
      'ExpoFSReadAsStringAsync error',
      (error as Error)?.message || '',
    );
  }

  // **** use expo-asset
  // https://stackoverflow.com/a/77425150
  //
  // if (isNumber(nativeModuleId)) {
  //   try {
  //     const loadAsyncResult = await Asset.loadAsync(nativeModuleId);
  //     downloadedUri = loadAsyncResult?.[0]?.localUri;
  //     downloadedUri1 = (loadAsyncResult || [])
  //       .map((item) => item?.uri || '')
  //       .join(',');
  //     downloadedUri2 = (loadAsyncResult || [])
  //       .map((item) => item?.localUri || '')
  //       .join(',');
  //     if (downloadedUri) {
  //       base64a1 = await ExpoFSReadAsStringAsync(downloadedUri, {
  //         encoding: 'base64',
  //       });
  //     }
  //   } catch (error) {
  //     errors.push(
  //       'ExpoFSReadAsStringAsync downloadedUri error',
  //       (error as Error)?.message || '',
  //     );
  //   }
  // }

  // **** use react-native-image-base64
  // import RNImgToBase64 from 'react-native-image-base64';
  //
  // try {
  //   base64b = await RNImgToBase64.getBase64String(uri);
  // } catch (error) {
  //   errors.push(
  //     'RNImgToBase64.getBase64String error',
  //     (error as Error)?.message || '',
  //   );
  // }

  // **** use react-native-fs
  // try {
  //   base64c = await RNFS.readFile(uri, 'base64');
  // } catch (error) {
  //   errors.push('RNFS.readFile error', (error as Error)?.message || '');
  // }
  //
  let uri2: string | undefined;
  // try {
  //   uri2 = RNFS.MainBundlePath + uri;
  //   base64d = await RNFS.readFile(uri2, 'base64');
  // } catch (error) {
  //   errors.push('RNFS.readFile uri2 error', (error as Error)?.message || '');
  // }

  logFn?.('getRNLocalImageBase64 errors', errors.join('  |||   '));
  logFn?.('getRNLocalImageBase64 uris', uri, downloadedUri || '', uri2 || '');
  logFn?.('getRNLocalImageBase64 downloadedUri', downloadedUri || '');
  logFn?.('getRNLocalImageBase64 downloadedUri1', downloadedUri1 || '');
  logFn?.('getRNLocalImageBase64 downloadedUri2', downloadedUri2 || '');
  logFn?.(
    'getRNLocalImageBase64 base64',
    base64a || '',
    base64a1 || '',
    base64b || '',
    base64c || '',
    base64d || '',
  );

  const base64 = base64a || base64a1 || base64b || base64c || base64d;
  if (!base64) {
    throw new Error('getRNLocalImageBase64 failed');
  }

  return base64;
}

async function getBase64FromImageUriNative({
  nativeModuleId,
  uri,
  logFn,
}: {
  nativeModuleId?: number;
  uri: string;
  logFn?: ICommonImageLogFn;
}): Promise<string | undefined> {
  try {
    // remote uri
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      const savedPath = `${documentDirectory || ''}tmp-get-rn-image-base64.jpg`;
      logFn?.('(native) download remote image', savedPath, uri);
      // eslint-disable-next-line no-param-reassign
      ({ uri } = await ExpoFSDownloadAsync(uri, savedPath));
      logFn?.('(native) download to local uri', uri);
    }
    const base64 = await getRNLocalImageBase64({
      nativeModuleId,
      uri,
      logFn,
    });
    logFn?.('(native) local uri to base64', uri, base64);
    return prefixBase64Uri(base64, 'image/jpeg');
  } catch (error) {
    logFn?.(
      '(native) local uri to base64 ERROR',
      uri,
      (error as Error | undefined)?.message || 'unknown error',
    );
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

async function getBase64FromImageUri({
  uri,
  nativeModuleId,
  logFn,
}: {
  uri: string | undefined;
  nativeModuleId?: number;
  logFn?: ICommonImageLogFn;
}): Promise<string | undefined> {
  if (!uri) {
    return undefined;
  }

  if (isBase64Uri(uri)) {
    return uri;
  }

  if (platformEnv.isNative) {
    return getBase64FromImageUriNative({ nativeModuleId, uri, logFn });
  }
  return getBase64FromImageUriWeb(uri);
}

async function getUriFromRequiredImageSource(
  source: ImageSourcePropType | string | undefined,
  logFn?: ICommonImageLogFn,
): Promise<string | undefined> {
  try {
    logFn?.(
      'ImageSource type',
      `isString=${isString(source).toString()}`,
      `isArray=${isArray(source).toString()}`,
      `isNumber=${isNumber(source).toString()}`,
      `isNil=${isNil(source).toString()}`,
      `isObject=${isObject(source) ? Object.keys(source).join(',') : 'false'}`,
    );
  } catch (error) {
    // ignore
  }

  if (platformEnv.isNative && !isNil(source) && !isString(source)) {
    if (isNumber(source)) {
      try {
        logFn?.('(native) ImageSource number', source.toString());
      } catch (error) {
        // ignore
      }
    }
    const resolvedAssetSource = RNImage.resolveAssetSource(source);
    const uri = resolvedAssetSource.uri;
    logFn?.(
      '(native) ImageSource resolved to local uri',
      uri,
      resolvedAssetSource.uri,
    );
    return uri;
  }
  if (typeof source === 'string') {
    logFn?.('ImageSource is string', source);
    return source;
  }
  if (isArray(source)) {
    logFn?.('ImageSource is array');
    return undefined;
  }
  if (isNumber(source)) {
    logFn?.('ImageSource is number', source.toString());
    return undefined;
  }
  logFn?.('ImageSource source.uri', source?.uri || '');
  return source?.uri;
}

async function getBase64FromRequiredImageSource(
  source: ImageSourcePropType | string | undefined,
  logFn?: ICommonImageLogFn,
): Promise<string | undefined> {
  const uri = await getUriFromRequiredImageSource(source, logFn);
  logFn?.('getUriFromRequiredImageSource uri', uri || '');
  return getBase64FromImageUri({
    nativeModuleId: isNumber(source) ? source : undefined,
    uri,
    logFn,
  });
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
    return globalThis.$webembedApiProxy.imageUtils.base64ImageToBitmap({
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
  buildHtmlImage,
};
