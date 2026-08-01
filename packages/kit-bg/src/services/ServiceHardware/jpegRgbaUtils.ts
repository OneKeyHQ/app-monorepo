import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const jpeg = require('jpeg-js') as {
  decode: (
    data: Uint8Array,
    options: { useTArray: true; formatAsRGBA: true },
  ) => { width: number; height: number; data: Uint8Array };
};

export function decodeJpegToRgba({
  imageHex,
  expectedWidth,
  expectedHeight,
  label,
}: {
  imageHex: string;
  expectedWidth: number;
  expectedHeight: number;
  label: string;
}) {
  if (!imageHex) {
    throw new OneKeyLocalError(`Upload ${label} error: image is empty`);
  }
  const decoded = jpeg.decode(Buffer.from(imageHex, 'hex'), {
    useTArray: true,
    formatAsRGBA: true,
  });
  if (decoded.width !== expectedWidth || decoded.height !== expectedHeight) {
    throw new OneKeyLocalError(
      `Invalid ${label} size: ${decoded.width}x${decoded.height}, expected ${expectedWidth}x${expectedHeight}`,
    );
  }
  if (decoded.data.byteLength !== expectedWidth * expectedHeight * 4) {
    throw new OneKeyLocalError(
      `Invalid ${label} RGBA length: ${decoded.data.byteLength}`,
    );
  }
  return decoded;
}
