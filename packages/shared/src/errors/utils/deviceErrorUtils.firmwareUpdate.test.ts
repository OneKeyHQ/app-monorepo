import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { ETranslations } from '../../locale';
import { FirmwareDownloadFailed, NetworkError } from '../errors/hardwareErrors';

import { convertDeviceError } from './deviceErrorUtils';

describe('convertDeviceError firmware update failures', () => {
  it('maps a remote-config refresh failure to a network error', () => {
    const error = convertDeviceError({
      code: HardwareErrorCode.FirmwareUpdateDownloadFailed,
      error: 'Unable to refresh the latest remote config',
      connectId: 'ios-ble-connect-id',
    });

    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({
      code: HardwareErrorCode.NetworkError,
      key: ETranslations.hardware_no_connection_desc,
      payload: {
        code: HardwareErrorCode.FirmwareUpdateDownloadFailed,
        connectId: 'ios-ble-connect-id',
        message: 'Unable to refresh the latest remote config',
      },
    });
  });

  it('keeps an actual firmware download failure as a download error', () => {
    const error = convertDeviceError({
      code: HardwareErrorCode.FirmwareUpdateDownloadFailed,
      error: 'Failed to download firmware binary',
    });

    expect(error).toBeInstanceOf(FirmwareDownloadFailed);
    expect(error.code).toBe(HardwareErrorCode.FirmwareUpdateDownloadFailed);
  });
});
