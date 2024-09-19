/* eslint-disable spellcheck/spell-checker */

import imageUtils from './imageUtils';

import type { IDeviceType } from '@onekeyfe/hd-core';

const HAS_MONOCHROME_SCREEN: Partial<Record<IDeviceType, boolean>> = {
  classic: true,
  classic1s: true,
  mini: true,
};

const defaultT1Infomation: {
  width: number;
  height: number;
  supports: Array<'png' | 'jpeg'>;
} = { width: 128, height: 64, supports: ['png', 'jpeg'] };

const deviceModelInformation: Partial<
  Record<
    IDeviceType,
    { width: number; height: number; supports: Array<'png' | 'jpeg'> }
  >
> = {
  classic: { ...defaultT1Infomation },
  classic1s: { ...defaultT1Infomation },
  mini: { ...defaultT1Infomation },
};

const range = (length: number) => [...Array(length).keys()];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const toGrayscale = (red: number, green: number, blue: number): number =>
  Math.round(0.299 * red + 0.587 * green + 0.114 * blue);

function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = (e) => reject(e);
    image.src = dataUrl;
  });
}

function isMonochromeScreen(deviceModelInternal: IDeviceType): boolean {
  return HAS_MONOCHROME_SCREEN[deviceModelInternal] ?? false;
}

function imageToCanvas(
  image: HTMLImageElement,
  deviceModelInternal: IDeviceType,
) {
  if (!deviceModelInformation[deviceModelInternal]) {
    throw new Error(
      `imageToCanvas ERROR: Device model not supported: ${deviceModelInternal}`,
    );
  }
  const { width, height } = deviceModelInformation[deviceModelInternal] || {
    ...defaultT1Infomation,
  };

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

function bitmap(imageData: ImageData, deviceModelInternal: IDeviceType) {
  if (!deviceModelInformation[deviceModelInternal]) {
    throw new Error(
      `imageToCanvas ERROR: Device model not supported: ${deviceModelInternal}`,
    );
  }
  const { width, height } = deviceModelInformation[deviceModelInternal] || {
    ...defaultT1Infomation,
  };

  const homescreen = range(height)
    .map((j) =>
      range(width / 8)
        .map((i) => {
          const bytestr = range(8)
            .map((k) => (j * width + i * 8 + k) * 4)
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

// const toig = (imageData: ImageData, deviceModelInternal: IDeviceType) => {
//   if (!deviceModelInformation[deviceModelInternal]) {
//     throw new Error(
//       `imageToCanvas ERROR: Device model not supported: ${deviceModelInternal}`,
//     );
//   }
//   const { width, height } = deviceModelInformation[deviceModelInternal];

//   const pixels = range(height)
//     .map((row) =>
//       range(width).map((col) => {
//         const i = row * width + col;
//         const r = imageData.data[4 * i];
//         const g = imageData.data[4 * i + 1];
//         const b = imageData.data[4 * i + 2];

//         return toGrayscale(r, g, b);
//       }),
//     )
//     .flat();

//   // Pack two grayscale pixels into one byte (each pixel is 4 bits)
//   const bytes = [];
//   for (let i = 0; i < pixels.length; i += 2) {
//     const even = pixels[i];
//     const odd = pixels[i + 1];

//     // Use the even pixel for the higher 4 bits and odd pixel for the lower 4 bits.
//     // eslint-disable-next-line no-bitwise
//     const packedByte = ((even & 0xf0) >> 4) | (odd & 0xf0);
//     bytes.push(packedByte);
//   }

//   const packed = deflateRaw(Uint8Array.from(bytes), {
//     level: 9,
//     windowBits: 10,
//   });

//   // https://github.com/trezor/trezor-firmware/blob/master/docs/misc/toif.md
//   let header = '544f4947'; // 'TOIG' (indicating grayscale mode)
//   header += rightPad(4, width.toString(16));
//   header += rightPad(4, height.toString(16));
//   let length = Number(packed.length).toString(16);
//   if (length.length % 2 > 0) {
//     length = evenPad(length);
//   }
//   length = chunkString(2, length).reverse().join('');
//   header += rightPad(8, length);

//   return header + byteArrayToHexString(packed);
// };

async function imagePathToHex(
  base64OrUri: string,
  deviceModelInternal: IDeviceType,
): Promise<string> {
  const base64 = await imageUtils.getBase64FromImageUri(base64OrUri);
  if (!base64) {
    throw new Error('imagePathToHex ERROR: base64 is null');
  }

  // image can be loaded to device without modifications -> it is in original quality
  if (!HAS_MONOCHROME_SCREEN[deviceModelInternal]) {
    // convert base64 to blob
    const buffer = Buffer.from(base64, 'base64');
    return buffer.toString('hex');
  }

  /*
   * However, this method accepts the Canvas format which changes the quality of image
   */
  //   const blob = await response.blob();
  //   const blobUrl = URL.createObjectURL(blob);
  const element = await dataUrlToImage(base64);
  const { canvas, ctx } = imageToCanvas(element, deviceModelInternal);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // **** T2, T3 model
  //   if (
  //     [DeviceModelInternal.T2B1, DeviceModelInternal.T3B1].includes(
  //       deviceModelInternal,
  //     )
  //   ) {
  //     return toig(imageData, deviceModelInternal);
  //   }

  // **** T1 model
  // DeviceModelInternal.T1B1
  return bitmap(imageData, deviceModelInternal);
}

export default {
  imagePathToHex,
  isMonochromeScreen,
};
