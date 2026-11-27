import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import { Image as RNImage } from 'react-native';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import type { IPro2BleFirmwarePickedFile } from './pro2BleFirmwareAssets';

export type { IPro2BleFirmwarePickedFile } from './pro2BleFirmwareAssets';

const MAX_PICKED_FIRMWARE_SIZE = 4 * 1024 * 1024;

const PRO2_BLE_FIRMWARE_ASSETS: Record<string, number> = {
  'findmy-debug-1.0.23':
    require('./assets/pro2-ble-findmy-debug-1.0.23.bin') as number,
  'findmy-debug-1.0.24':
    require('./assets/pro2-ble-findmy-debug-1.0.24.bin') as number,
  'findmy-production-1.0.23':
    require('./assets/pro2-ble-findmy-production-1.0.23.bin') as number,
  'findmy-production-1.0.24':
    require('./assets/pro2-ble-findmy-production-1.0.24.bin') as number,
};

async function readLocalFileBase64(uri: string): Promise<string> {
  if (!RNFS) {
    throw new OneKeyLocalError('Cannot read the Bluetooth firmware file');
  }
  const filePath = uri.startsWith('file://')
    ? uri.slice('file://'.length)
    : uri;
  const firmwareBase64 = await RNFS.readFile(
    decodeURIComponent(filePath),
    'base64',
  );
  if (!firmwareBase64) {
    throw new OneKeyLocalError('Cannot read the Bluetooth firmware file');
  }
  return firmwareBase64;
}

export async function loadPro2BleFirmwareBase64(
  firmwareId: string,
  title: string,
): Promise<string> {
  const asset = PRO2_BLE_FIRMWARE_ASSETS[firmwareId];
  const uri = asset ? RNImage.resolveAssetSource(asset)?.uri : undefined;
  if (!uri) {
    throw new OneKeyLocalError(`Bluetooth firmware asset is missing: ${title}`);
  }
  // Metro dev server serves assets over HTTP; release builds read from disk.
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new OneKeyLocalError(
        `Bluetooth firmware download failed: ${response.status}`,
      );
    }
    return bufferUtils.bytesToBase64(
      new Uint8Array(await response.arrayBuffer()),
    );
  }
  return readLocalFileBase64(uri);
}

export async function pickPro2BleFirmwareFile(): Promise<
  IPro2BleFirmwarePickedFile | undefined
> {
  let picked;
  try {
    [picked] = await pick({ type: [types.allFiles] });
  } catch (error) {
    if (
      isErrorWithCode(error) &&
      error.code === errorCodes.OPERATION_CANCELED
    ) {
      return undefined;
    }
    throw error;
  }
  if (!picked?.uri) {
    return undefined;
  }
  if (picked.size && picked.size > MAX_PICKED_FIRMWARE_SIZE) {
    throw new OneKeyLocalError(
      'Selected file is too large for a Pro 2 package',
    );
  }
  const name = picked.name ?? 'firmware.bin';
  const [localCopy] = await keepLocalCopy({
    files: [{ uri: picked.uri, fileName: name }],
    destination: 'cachesDirectory',
  });
  if (localCopy.status !== 'success') {
    throw new OneKeyLocalError('Cannot copy the selected firmware file');
  }
  try {
    const firmwareBase64 = await readLocalFileBase64(localCopy.localUri);
    return { name, firmwareBase64 };
  } finally {
    void RNFS?.unlink(
      decodeURIComponent(localCopy.localUri.replace(/^file:\/\//, '')),
    ).catch(() => undefined);
  }
}
