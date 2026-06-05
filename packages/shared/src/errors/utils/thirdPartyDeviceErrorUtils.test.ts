import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import { convertDeviceError } from './deviceErrorUtils';
import {
  classifyThirdPartyHwCreateFailures,
  convertThirdPartyDeviceError,
  filterThirdPartyHwCreateFailureToasts,
  normalizeThirdPartyDeviceErrorCode,
} from './thirdPartyDeviceErrorUtils';

describe('convertThirdPartyDeviceError', () => {
  it('maps invalid firmware metadata responses to network errors', () => {
    const error = convertThirdPartyDeviceError({
      code: ThirdPartyHwErrorCode.UnknownError,
      error: 'InvalidGetFirmwareMetadataResponseError',
      _tag: 'InvalidGetFirmwareMetadataResponseError',
    });

    expect(error.code).toBe(ThirdPartyHwErrorCode.NetworkError);
  });

  it('normalizes numeric string error codes before classification', () => {
    expect(
      normalizeThirdPartyDeviceErrorCode({
        code: String(ThirdPartyHwErrorCode.DeviceOutOfMemory),
      }),
    ).toBe(ThirdPartyHwErrorCode.DeviceOutOfMemory);
  });
});

describe('convertDeviceError', () => {
  it('preserves invalid firmware metadata tags for third-party hardware errors', () => {
    const sdkPayload = {
      code: ThirdPartyHwErrorCode.UnknownError,
      error: 'InvalidGetFirmwareMetadataResponseError',
      _tag: 'InvalidGetFirmwareMetadataResponseError',
    };
    const error = convertDeviceError(sdkPayload);

    expect(error.code).toBe(ThirdPartyHwErrorCode.NetworkError);
  });
});

describe('classifyThirdPartyHwCreateFailures', () => {
  it('keeps device out-of-memory failures when at least one account succeeded', () => {
    const failedAccount = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceOutOfMemory,
      },
    };
    const result = classifyThirdPartyHwCreateFailures({
      addedCount: 1,
      failedAccounts: [failedAccount],
    });

    expect(result.allAppNotInstalled).toBe(false);
    expect(result.genuineFailures).toEqual([failedAccount]);
  });
});

describe('filterThirdPartyHwCreateFailureToasts', () => {
  it('keeps only one device out-of-memory failure for toast display', () => {
    const first = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceOutOfMemory,
        message: 'Not enough space',
      },
    };
    const second = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceOutOfMemory,
        message: 'Not enough space',
      },
    };

    expect(filterThirdPartyHwCreateFailureToasts([first, second])).toEqual([
      first,
    ]);
  });

  it('drops failures explicitly marked as autoToast=false', () => {
    const first = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceOutOfMemory,
        message: 'Not enough space',
      },
    };
    const muted = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceOutOfMemory,
        message: 'Not enough space',
        autoToast: false,
      },
    };

    expect(filterThirdPartyHwCreateFailureToasts([first, muted])).toEqual([
      first,
    ]);
  });
});
