import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { DeviceLockedError } from '../errors/hardwareErrors';

import { convertDeviceError } from './deviceErrorUtils';

describe('convertDeviceError Protocol V2 device locked', () => {
  it('uses the existing unlock-device guidance for Pro2 and Neo', () => {
    const error = convertDeviceError({
      code: HardwareErrorCode.DeviceLocked,
      error: 'Device locked',
      params: {
        failureCode: 'Failure_ProcessError',
        subcode: 9,
      },
    });

    expect(error).toBeInstanceOf(DeviceLockedError);
    expect(error).toMatchObject({
      code: HardwareErrorCode.DeviceLocked,
      key: 'hardware_third_party_device_locked',
      payload: {
        code: HardwareErrorCode.DeviceLocked,
        error: 'Device locked',
        params: {
          failureCode: 'Failure_ProcessError',
          subcode: 9,
        },
      },
    });
  });
});
