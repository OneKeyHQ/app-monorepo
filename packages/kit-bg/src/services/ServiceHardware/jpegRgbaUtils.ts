import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const jpeg = require('jpeg-js') as {
  decode: (
    data: Uint8Array,
    options: {
      useTArray: true;
      formatAsRGBA: true;
      maxResolutionInMP: number;
      maxMemoryUsageInMB: number;
    },
  ) => { width: number; height: number; data: Uint8Array };
};

const JPEG_MAX_RESOLUTION_IN_MP = 1;
const JPEG_MAX_MEMORY_USAGE_IN_MB = 32;
const JPEG_CONTAINER_OVERHEAD_BYTES = 64 * 1024;

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
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(imageHex)) {
    throw new OneKeyLocalError(`Upload ${label} error: image hex is invalid`);
  }
  const maxEncodedBytes =
    expectedWidth * expectedHeight * 8 + JPEG_CONTAINER_OVERHEAD_BYTES;
  if (imageHex.length / 2 > maxEncodedBytes) {
    throw new OneKeyLocalError(`Upload ${label} error: image is too large`);
  }
  const decoded = jpeg.decode(Buffer.from(imageHex, 'hex'), {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: JPEG_MAX_RESOLUTION_IN_MP,
    maxMemoryUsageInMB: JPEG_MAX_MEMORY_USAGE_IN_MB,
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
