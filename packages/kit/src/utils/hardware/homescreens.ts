/* eslint-disable no-bitwise */
/* eslint-disable no-param-reassign */
import { Buffer } from 'buffer';

import { bytesToHex } from '@noble/hashes/utils';
import { ResourceType } from '@onekeyfe/hd-transport';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import type { HomescreenItem } from './constants/homescreens';
import type { DeviceUploadResourceParams } from '@onekeyfe/hd-core';
import type { Action } from 'expo-image-manipulator';

const T1_WIDTH = 128;
const T1_HEIGHT = 64;

const canvasId = 'homescreen-canvas';
const supportedDataUrlRE = /^data:image\/(jpeg|png)/;

const getWidth = () => T1_WIDTH;

const getHeight = () => T1_HEIGHT;

const range = (length: number) => [...Array(length).keys()];

const getCanvas = () => {
  const canvas = document.getElementById(canvasId);
  if (canvas != null && canvas instanceof HTMLCanvasElement) {
    return canvas;
  }
  const newCanvas = document.createElement('canvas');
  newCanvas.id = canvasId;
  newCanvas.style.visibility = 'hidden';
  newCanvas.style.position = 'absolute';
  newCanvas.style.height = '0';
  const { body } = document;
  if (body == null) {
    throw new Error('document.body is null');
  }
  body.appendChild(newCanvas);
  return newCanvas;
};

const removeCanvas = () => {
  const el = document.getElementById(canvasId);
  if (el) {
    el.remove();
  }
};

const toig = (w: number, h: number, imageData: ImageData) => {
  const homescreen = range(h)
    .map((j) =>
      range(w / 8)
        .map((i) => {
          const bytestr = range(8)
            .map((k) => (j * w + i * 8 + k) * 4)
            .map((index) => (imageData.data[index] === 0 ? '0' : '1'))
            .join('');
          return String.fromCharCode(parseInt(bytestr, 2));
        })
        .join(''),
    )
    .join('');
  const hex = homescreen
    .split('')
    .map((letter) => letter.charCodeAt(0))
    .map((charCode) => charCode & 0xff)
    .map((charCode) => charCode.toString(16))
    .map((chr) => (chr.length < 2 ? `0${chr}` : chr))
    .join('');
  return hex;
};

export const fileToDataUrl = (file: File): Promise<string> => {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = (e) =>
      // @ts-ignore
      resolve(e.target.result);
    reader.onerror = (err) => {
      reject(err);
    };
    reader.readAsDataURL(file);
  });
};

const dataUrlToImage = (dataUrl: string): Promise<HTMLImageElement> => {
  const image = new Image();
  return new Promise((resolve, reject) => {
    image.onload = () => {
      resolve(image);
    };
    image.onerror = (e) => {
      reject(e);
    };
    image.src = dataUrl;
  });
};

export const elementToImageData = (
  element: HTMLImageElement,
  width: number,
  height: number,
) => {
  const canvas = getCanvas();
  const ctx = canvas.getContext('2d');
  if (ctx == null) {
    throw new Error('2D context is null');
  }
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(element, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  return imageData;
};

export const checkImage = (origImage: HTMLImageElement, model: number) => {
  const height = getHeight();
  const width = getWidth();
  if (origImage.height !== height) {
    throw new Error('Not a correct height.');
  }
  if (origImage.width !== width) {
    throw new Error('Not a correct width.');
  }

  const imageData = elementToImageData(origImage, width, height);

  if (model === 1) {
    range(imageData.height).forEach((j: number) => {
      range(imageData.width).forEach((i) => {
        const index = j * 4 * imageData.width + i * 4;
        const red = imageData.data[index];
        const green = imageData.data[index + 1];
        const blue = imageData.data[index + 2];
        const alpha = imageData.data[index + 3];
        if (alpha !== 255) {
          throw new Error('Unexpected alpha.');
        }
        let good = false;
        if (red === 0 && green === 0 && blue === 0) {
          good = true;
        }
        if (red === 255 && green === 255 && blue === 255) {
          good = true;
        }
        if (!good) {
          throw new Error(`wrong color combination ${red} ${green} ${blue}.`);
        }
      });
    });
  }
};

export const check = (file: File, model: number) =>
  fileToDataUrl(file)
    .then((url: string) => dataUrlToImage(url))
    .then((image) => checkImage(image, model));

export const imageDataToHex = (imageData: ImageData) => {
  const w = getWidth();
  const h = getHeight();

  return toig(w, h, imageData);
};

export const isValid = (dataUrl: string) =>
  !!dataUrl && supportedDataUrlRE.test(dataUrl);

export const elementToHomescreen = (element: HTMLImageElement) => {
  const w = getWidth();
  const h = getHeight();
  const imageData = elementToImageData(element, w, h);
  const hex = imageDataToHex(imageData);
  removeCanvas();
  return hex;
};

export const imageCache: Record<string, Partial<HomescreenItem>> = {};

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
        height,
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

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export const generateUploadResParams = async (
  uri: string,
  width: number,
  height: number,
) => {
  const data = await compressHomescreen(uri, 480, 800, width, height);
  const zoomData = await compressHomescreen(uri, 144, 240, width, height);

  if (!data?.arrayBuffer && !zoomData?.arrayBuffer) return;

  debugLogger.hardwareSDK.info(
    'homescreen data byte length: ',
    formatBytes(data?.arrayBuffer?.byteLength ?? 0, 3),
  );
  debugLogger.hardwareSDK.info(
    'homescreen thumbnail byte length: ',
    formatBytes(zoomData?.arrayBuffer?.byteLength ?? 0, 3),
  );

  const params: DeviceUploadResourceParams = {
    resType: ResourceType.WallPaper,
    suffix: 'jpeg',
    dataHex: bytesToHex(data?.arrayBuffer as Uint8Array),
    thumbnailDataHex: bytesToHex(zoomData?.arrayBuffer as Uint8Array),
    nftMetaData: '',
  };

  return params;
};
