import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const COPROCESSOR_PACKAGE_HEADER_LENGTH = 12;

export function decodePro2BleFirmwareBase64(
  firmwareBase64: string,
): ArrayBuffer {
  const bytes = Buffer.from(firmwareBase64, 'base64');
  if (bytes.byteLength < COPROCESSOR_PACKAGE_HEADER_LENGTH) {
    throw new OneKeyLocalError('Pro 2 Bluetooth firmware package is empty');
  }
  const magic = bytes.subarray(0, 4).toString('utf8');
  const packageType = bytes.subarray(8, 12).toString('utf8');
  if (magic !== 'OKPP' || packageType !== 'COPR') {
    throw new OneKeyLocalError(
      'Pro 2 Bluetooth firmware must be a signed coprocessor package',
    );
  }
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

export function buildPro2CoprocessorFirmwareUpdateParams(binary: ArrayBuffer) {
  return {
    platform: 'native' as const,
    targetsToUpdate: ['coprocessor' as const],
    coprocessorBinary: binary,
  };
}
