/* eslint-disable spellcheck/spell-checker */

import imageUtils from './imageUtils';

import type { IDeviceType } from '@onekeyfe/hd-core';

const HAS_MONOCHROME_SCREEN: Partial<Record<IDeviceType, boolean>> = {
  classic: true,
  classic1s: true,
  mini: true,
};

export const T1_HOME_SCREEN_DEFAULT_IMAGES = [
  'blank',
  'original',
  'bitcoin_shade',
  'bitcoin_full',
  'ethereum',
  'bitcoin_b',
  'doge',
  'coffee',
  'carlos',
  'einstein',
  'anonymous',
  'piggy',
  'nyancat',
  'dogs',
  'pacman',
  'tetris',
  'tothemoon',
  'xrc',
];

export const DEFAULT_T1_HOME_SCREEN_INFORMATION: {
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
  classic: { ...DEFAULT_T1_HOME_SCREEN_INFORMATION },
  classic1s: { ...DEFAULT_T1_HOME_SCREEN_INFORMATION },
  mini: { ...DEFAULT_T1_HOME_SCREEN_INFORMATION },
};

function isMonochromeScreen(deviceModelInternal: IDeviceType): boolean {
  return HAS_MONOCHROME_SCREEN[deviceModelInternal] ?? false;
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
  deviceType: IDeviceType,
): Promise<string> {
  if (!deviceModelInformation[deviceType]) {
    throw new Error(
      `imagePathToHex ERROR: Device model not supported: ${deviceType}`,
    );
  }
  const { width, height } = deviceModelInformation[deviceType] || {
    ...DEFAULT_T1_HOME_SCREEN_INFORMATION,
  };

  const base64 = await imageUtils.getBase64FromImageUri({
    uri: base64OrUri,
  });
  if (!base64) {
    throw new Error('imagePathToHex ERROR: base64 is null');
  }

  // image can be loaded to device without modifications -> it is in original quality
  if (!HAS_MONOCHROME_SCREEN[deviceType]) {
    // convert base64 to blob
    const buffer = Buffer.from(base64, 'base64');
    return buffer.toString('hex');
  }

  /*
   * However, this method accepts the Canvas format which changes the quality of image
   */
  //   const blob = await response.blob();
  //   const blobUrl = URL.createObjectURL(blob);

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
  return imageUtils.base64ImageToBitmap({
    base64,
    width,
    height,
  });
}

export default {
  imagePathToHex,
  isMonochromeScreen,
};
