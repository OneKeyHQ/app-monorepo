import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import { THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE } from '../errors/thirdPartyHardwareErrors';

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

  it('maps all-network install cancel code before generic hardware fallback', () => {
    const error = convertDeviceError({
      code: THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE,
      error: 'User declined to install Tron',
    });

    expect(error.code).toBe(THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE);
    expect(error.autoToast).toBe(false);
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

  it('drops all-network install cancel failures from genuine failures', () => {
    const installCancel = {
      error: {
        code: THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE,
      },
    };
    const deviceOutOfMemory = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceOutOfMemory,
      },
    };
    const result = classifyThirdPartyHwCreateFailures({
      addedCount: 1,
      failedAccounts: [installCancel, deviceOutOfMemory],
    });

    expect(result.allAppNotInstalled).toBe(false);
    expect(result.genuineFailures).toEqual([deviceOutOfMemory]);
  });

  it('keeps unknown failures when at least one account succeeded', () => {
    const unknownFailure = {
      error: {
        code: ThirdPartyHwErrorCode.UnknownError,
      },
    };
    const result = classifyThirdPartyHwCreateFailures({
      addedCount: 1,
      failedAccounts: [unknownFailure],
    });

    expect(result.allAppNotInstalled).toBe(false);
    expect(result.genuineFailures).toEqual([unknownFailure]);
  });

  it('drops device-not-found failures when at least one account succeeded', () => {
    const deviceNotFoundFailure = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceNotFound,
      },
    };
    const result = classifyThirdPartyHwCreateFailures({
      addedCount: 1,
      failedAccounts: [deviceNotFoundFailure],
    });

    expect(result.allAppNotInstalled).toBe(false);
    expect(result.genuineFailures).toEqual([]);
  });

  it('keeps device-not-found failures when no account succeeded', () => {
    const deviceNotFoundFailure = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceNotFound,
      },
    };
    const result = classifyThirdPartyHwCreateFailures({
      addedCount: 0,
      failedAccounts: [deviceNotFoundFailure],
    });

    expect(result.allAppNotInstalled).toBe(false);
    expect(result.genuineFailures).toEqual([deviceNotFoundFailure]);
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

  it('drops all-network install cancel failures even without autoToast=false', () => {
    const installCancel = {
      error: {
        code: THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE,
        message: 'User declined to install Tron',
      },
    };

    expect(filterThirdPartyHwCreateFailureToasts([installCancel])).toEqual([]);
  });
});
