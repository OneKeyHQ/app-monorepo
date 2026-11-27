import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// Package header: magic[0..4], package type[8..12], version patch/minor/major
// bytes at [16], [17], [18].
const COPROCESSOR_PACKAGE_HEADER_LENGTH = 19;

function assertPro2CoprocessorPackage(bytes: Uint8Array) {
  if (bytes.byteLength < COPROCESSOR_PACKAGE_HEADER_LENGTH) {
    throw new OneKeyLocalError('Pro 2 Bluetooth firmware package is empty');
  }
  const magic = Buffer.from(bytes.subarray(0, 4)).toString('utf8');
  const packageType = Buffer.from(bytes.subarray(8, 12)).toString('utf8');
  if (magic !== 'OKPP' || packageType !== 'COPR') {
    throw new OneKeyLocalError(
      'Pro 2 Bluetooth firmware must be a signed coprocessor package',
    );
  }
}

export function readPro2CoprocessorPackageVersion(bytes: Uint8Array): string {
  assertPro2CoprocessorPackage(bytes);
  return `${bytes[18]}.${bytes[17]}.${bytes[16]}`;
}

export function inspectPro2BleFirmwareBase64(firmwareBase64: string): {
  version: string;
  byteLength: number;
} {
  const bytes = Buffer.from(firmwareBase64, 'base64');
  return {
    version: readPro2CoprocessorPackageVersion(bytes),
    byteLength: bytes.byteLength,
  };
}

export function decodePro2BleFirmwareBase64(
  firmwareBase64: string,
): ArrayBuffer {
  const bytes = Buffer.from(firmwareBase64, 'base64');
  assertPro2CoprocessorPackage(bytes);
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
