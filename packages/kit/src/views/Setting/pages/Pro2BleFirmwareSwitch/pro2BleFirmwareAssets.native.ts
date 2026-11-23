import { Image as RNImage } from 'react-native';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

const PRO2_BLE_FIRMWARE_ASSETS: Record<string, number> = {
  'release-1.0.20': require('./assets/pro2-ble-release-1.0.20.bin') as number,
};

export async function loadPro2BleFirmwareBase64(
  firmwareId: string,
  title: string,
): Promise<string> {
  const asset = PRO2_BLE_FIRMWARE_ASSETS[firmwareId];
  const uri = RNImage.resolveAssetSource(asset)?.uri;
  if (!uri) {
    throw new OneKeyLocalError(`Bluetooth firmware asset is missing: ${title}`);
  }
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
  if (!RNFS) {
    throw new OneKeyLocalError('Cannot read the bundled Bluetooth firmware');
  }
  const filePath = uri.startsWith('file://')
    ? uri.slice('file://'.length)
    : uri;
  const firmwareBase64 = await RNFS.readFile(
    decodeURIComponent(filePath),
    'base64',
  );
  if (!firmwareBase64) {
    throw new OneKeyLocalError('Cannot read the bundled Bluetooth firmware');
  }
  return firmwareBase64;
}
