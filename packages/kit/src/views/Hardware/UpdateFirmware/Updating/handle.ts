import axios from 'axios';

import { HardwareSDK, deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type ProgressCall = (progress: number) => void;
export type DownloadOptions = {
  url: string;
  onProgress?: ProgressCall;
};

export const download = (url: string, call?: ProgressCall) =>
  axios
    .request({
      url,
      withCredentials: false,
      responseType: 'arraybuffer',
      onDownloadProgress: (progressEvent) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const total = parseFloat(progressEvent.total);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const current = progressEvent.loaded;
        const percentCompleted = Math.floor((current / total) * 100);
        call?.(percentCompleted);
      },
    })
    .then((response) => {
      if (+response.status === 200) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return response.data;
      }
      throw new Error(`httpRequest error: ${url} ${response.statusText}`);
    });

export const downloadBleFirmware = (options: DownloadOptions) => {
  const { url, onProgress } = options;
  return download(url, onProgress);
};

export const downloadSysFirmware = (options: DownloadOptions) => {
  const { url, onProgress } = options;
  return download(url, onProgress);
};

export type FirmwareType = 'firmware' | 'ble';

export const rebootToBootloader = (connectId: string) =>
  HardwareSDK.deviceUpdateReboot(connectId).then((response) => {
    if (!response.success) {
      throw new Error('deviceUpdateReboot failed');
    }
    return response;
  });

export const installFirmware = (
  connectId: string,
  binary: any,
  firmwareType: FirmwareType,
  call?: ProgressCall,
) => {
  console.log('installFirmware', connectId);

  // @ts-expect-error
  return HardwareSDK.firmwareUpdate(
    platformEnv.isNative ? connectId : undefined,
    {
      binary,
      updateType: firmwareType,
    },
  ).then((response) => {
    if (!response.success) {
      throw deviceUtils.convertDeviceError(response.payload);
    }
    return response.payload;
  });
};
