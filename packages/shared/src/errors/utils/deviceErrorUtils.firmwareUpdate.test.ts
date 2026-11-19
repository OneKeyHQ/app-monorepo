import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { ETranslations } from '../../locale';
import { FirmwareDownloadFailed, NetworkError } from '../errors/hardwareErrors';

import { convertDeviceError, convertDeviceResponse } from './deviceErrorUtils';
import { toPlainErrorObject } from './errorUtils';

describe('convertDeviceError firmware update failures', () => {
  it.each([false, true])(
    'preserves Portfolio upgrade guidance across the RPC boundary (silent=%s)',
    async (silentMode) => {
      const payload = {
        code: HardwareErrorCode.CallMethodNeedUpgradeFirmware,
        error: 'Device firmware version is too low',
        connectId: 'portfolio-device',
        params: {
          method: 'uploadPortfolio',
          current: '1.0.2',
          require: '1.0.3',
        },
      };
      const error = await convertDeviceResponse(
        async () => ({ success: false, payload }),
        { silentMode },
      ).catch((e: unknown) => e);

      expect(toPlainErrorObject(error)).toMatchObject({
        code: HardwareErrorCode.CallMethodNeedUpgradeFirmware,
        key: ETranslations.hardware_version_need_upgrade_error,
        info: { version: '1.0.3' },
        payload,
      });
      expect(toPlainErrorObject(error)?.autoToast).not.toBe(true);
    },
  );

  it('retains the required version guidance for other SDK methods', () => {
    const error = convertDeviceError({
      code: HardwareErrorCode.CallMethodNeedUpgradeFirmware,
      params: { method: 'solSignTransaction', require: '4.9.0' },
    });

    expect(error).toMatchObject({
      key: ETranslations.hardware_version_need_upgrade_error,
      info: { version: '4.9.0' },
    });
  });

  it('keeps actual invalid Portfolio packages as hardware failures', () => {
    const error = convertDeviceError({
      code: HardwareErrorCode.RuntimeError,
      error: 'Failure_DataError,Invalid portfolio package',
    });

    expect(error).toMatchObject({
      key: ETranslations.wallet_action_failed,
      payload: { code: HardwareErrorCode.RuntimeError },
    });
    expect(error.message).toContain('Invalid portfolio package');
  });

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
