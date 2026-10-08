import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { OneKeyError } from '@onekeyhq/shared/src/errors/errors/baseErrors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';

import {
  authFailureAllowsContinue,
  classifyAuthFailureError,
} from './authFailureClassifier';

describe('classifyAuthFailureError', () => {
  it('reads the request layer offline error as network', () => {
    const error = new OneKeyError({
      message: 'Network Error',
      className: EOneKeyErrorClassNames.AxiosNetworkError,
    });
    expect(classifyAuthFailureError(error)).toBe('network');
  });

  it.each(['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'])(
    'reads a raw axios %s as network',
    (code) => {
      const error = Object.assign(new Error('axios'), { code });
      expect(classifyAuthFailureError(error as never)).toBe('network');
    },
  );

  it('reads a server outage as unavailable, ahead of the transient family', () => {
    const outage = Object.assign(
      new OneKeyError({
        message: 'server',
        className: EOneKeyErrorClassNames.OneKeyServerApiError,
      }),
      { httpStatusCode: 503 },
    );
    expect(classifyAuthFailureError(outage)).toBe('unavailable');
    const fiveHundred = Object.assign(new Error('502'), {
      httpStatusCode: 502,
    });
    expect(classifyAuthFailureError(fiveHundred as never)).toBe('unavailable');
  });

  it('keeps a server rejection on the strict side — the class alone opens nothing', () => {
    // A 403 or a business error on a 200 is a verdict against the
    // request, not an outage: no Continue anyway.
    const forbidden = Object.assign(
      new OneKeyError({
        message: 'forbidden',
        className: EOneKeyErrorClassNames.OneKeyServerApiError,
      }),
      { httpStatusCode: 403 },
    );
    expect(classifyAuthFailureError(forbidden)).toBe('unknown');
    const businessError = new OneKeyError({
      message: 'rejected',
      code: 10_001,
      className: EOneKeyErrorClassNames.OneKeyServerApiError,
    });
    expect(classifyAuthFailureError(businessError)).toBe('unknown');
  });

  it.each([
    HardwareErrorCode.BridgeNetworkError,
    HardwareErrorCode.NetworkError,
  ])('keeps the SDK transport failure %s on the strict side', (code) => {
    // Raised by the device transport during the certificate read, before
    // any server call: a device gone silent mid-cert must not read as
    // "our network failed".
    expect(classifyAuthFailureError(convertDeviceError({ code }))).toBe(
      'unknown',
    );
  });

  it.each([
    HardwareErrorCode.DeviceNotFound,
    HardwareErrorCode.BridgeDeviceDisconnected,
    HardwareErrorCode.BleDeviceDisconnected,
    HardwareErrorCode.PollingTimeout,
    HardwareErrorCode.DeviceInterruptedFromOutside,
  ])('reads a vanished device (%s) as disconnected', (code) => {
    expect(classifyAuthFailureError(convertDeviceError({ code }))).toBe(
      'disconnected',
    );
  });

  it('keeps a connected device that will not prove itself on unknown', () => {
    // An in-call bridge timeout cannot tell a gone device from a silent
    // one — the grey zone lands on the strict side.
    expect(
      classifyAuthFailureError(
        convertDeviceError({ code: HardwareErrorCode.BridgeTimeoutError }),
      ),
    ).toBe('unknown');
    expect(
      classifyAuthFailureError(
        convertDeviceError({ code: HardwareErrorCode.RuntimeError }),
      ),
    ).toBe('unknown');
    expect(classifyAuthFailureError(undefined)).toBe('unknown');
  });

  it('keeps the terminal verdicts', () => {
    expect(
      classifyAuthFailureError(
        convertDeviceError({ code: HardwareErrorCode.DefectiveFirmware }),
      ),
    ).toBe('defective');
    expect(
      classifyAuthFailureError(
        convertDeviceError({
          code: HardwareErrorCode.NotAllowInBootloaderMode,
        }),
      ),
    ).toBe('unofficialDevice');
  });
});

describe('authFailureAllowsContinue', () => {
  it('opens the bypass only where the device cannot be at fault', () => {
    expect(authFailureAllowsContinue('network')).toBe(true);
    expect(authFailureAllowsContinue('unavailable')).toBe(true);
    for (const reason of [
      'unknown',
      'disconnected',
      'unofficialDevice',
      'unofficialFirmware',
      'defective',
      undefined,
    ] as const) {
      expect(authFailureAllowsContinue(reason)).toBe(false);
    }
  });
});
