import axios from 'axios';

const DOWNLOAD_TIMEOUT = 120_000; // 2 minutes

export type IFirmwareFieldType = 'firmware' | 'firmware-v2' | 'bootloader';

/**
 * Download firmware binary from URL
 */
export async function downloadFirmwareBinary(
  url: string,
): Promise<ArrayBuffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: DOWNLOAD_TIMEOUT,
    withCredentials: false,
  });

  return response.data;
}

/**
 * Determine which firmware field to use for Touch legacy firmware
 * Touch devices with firmware version 3.4.x use 'firmware-v2'
 * Other versions use 'firmware'
 */
export function determineTouchFirmwareField(
  version: string,
): 'firmware' | 'firmware-v2' {
  // 3.4.x versions use firmware-v2
  if (version.startsWith('3.4.')) {
    return 'firmware-v2';
  }
  return 'firmware';
}
