import { HardwareSDK, deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type ProgressCall = (progress: number) => void;
export type DownloadOptions = {
  url: string;
  onProgress?: ProgressCall;
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
  firmwareType: FirmwareType,
  call?: ProgressCall,
) => {
  console.log('installFirmware', connectId, firmwareType);

  let interval = 10;
  if (firmwareType === 'firmware') {
    interval = 50;
  } else {
    interval = 10;
  }

  let timer: any;
  (() => {
    let progress = 0;
    timer = setInterval(() => {
      if (progress < 95) {
        if (call) {
          call(progress);
        }
        progress += 0.1;
      }
    }, interval);
  })();

  // @ts-expect-error
  return HardwareSDK.firmwareUpdate(
    platformEnv.isNative ? connectId : undefined,
    {
      updateType: firmwareType,
    },
  )
    .then((response) => {
      if (!response.success) {
        throw deviceUtils.convertDeviceError(response.payload);
      }
      return response.payload;
    })
    .finally(() => {
      if (timer) {
        clearInterval(timer);
      }
    });
};
