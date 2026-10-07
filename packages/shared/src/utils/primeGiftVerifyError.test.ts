import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { OneKeyServerApiError } from '../errors/errors/baseErrors';
import {
  PinCancelled,
  UserCancel,
  UserCancelFromOutside,
} from '../errors/errors/hardwareErrors';
import { EOneKeyErrorClassNames } from '../errors/types/errorTypes';
import {
  convertDeviceError,
  convertDeviceResponse,
} from '../errors/utils/deviceErrorUtils';

import {
  getPrimeGiftVerifyFailureLogPayload,
  isPrimeGiftVerifyCancellationError,
} from './primeGiftVerifyError';

const SENSITIVE = {
  serial: 'DEVICE_SERIAL',
  giftCode: 'TEST_CODE',
  userId: 'user-a',
  email: 'receiver@example.com',
  auth: 'access_token=secret-auth-material',
};

function leakText(prefix: string) {
  return `${prefix} ${SENSITIVE.serial} ${SENSITIVE.giftCode} ${SENSITIVE.userId} ${SENSITIVE.email} ${SENSITIVE.auth}`;
}

function expectNoSensitiveValues(value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain(SENSITIVE.serial);
  expect(serialized).not.toContain(SENSITIVE.giftCode);
  expect(serialized).not.toContain(SENSITIVE.userId);
  expect(serialized).not.toContain(SENSITIVE.email);
  expect(serialized).not.toContain(SENSITIVE.auth);
  expect(serialized).not.toContain('access_token=');
}

describe('isPrimeGiftVerifyCancellationError', () => {
  it('treats converted ActionCancelled as cancellation', () => {
    const error = convertDeviceError({
      code: HardwareErrorCode.ActionCancelled,
    });
    expect(error).toBeInstanceOf(UserCancel);
    expect(isPrimeGiftVerifyCancellationError(error)).toBe(true);
  });

  it('treats converted PinCancelled as cancellation', () => {
    const error = convertDeviceError({
      code: HardwareErrorCode.PinCancelled,
    });
    expect(error).toBeInstanceOf(PinCancelled);
    expect(isPrimeGiftVerifyCancellationError(error)).toBe(true);
  });

  it('treats convertDeviceResponse CallQueueActionCancelled as cancellation', async () => {
    const error = await convertDeviceResponse(async () => ({
      success: false,
      payload: {
        code: HardwareErrorCode.CallQueueActionCancelled,
        error: 'Action cancelled by user on call queue',
      },
    })).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UserCancel);
    expect(isPrimeGiftVerifyCancellationError(error)).toBe(true);
  });

  it('treats UserCancel and PinCancelled instances as cancellation', () => {
    expect(isPrimeGiftVerifyCancellationError(new UserCancel())).toBe(true);
    expect(isPrimeGiftVerifyCancellationError(new PinCancelled())).toBe(true);
  });

  it.each([
    {
      name: 'serialized ActionCancelled',
      error: {
        $isHardwareError: true,
        code: HardwareErrorCode.ActionCancelled,
      },
    },
    {
      name: 'serialized CallQueueActionCancelled payload.code',
      error: {
        className: EOneKeyErrorClassNames.OneKeyHardwareError,
        payload: { code: HardwareErrorCode.CallQueueActionCancelled },
      },
    },
    {
      name: 'serialized PinCancelled',
      error: {
        $isHardwareError: true,
        className: EOneKeyErrorClassNames.OneKeyHardwareError,
        payload: { code: HardwareErrorCode.PinCancelled },
      },
    },
  ])('treats $name as cancellation', ({ error }) => {
    expect(isPrimeGiftVerifyCancellationError(error)).toBe(true);
  });

  it('treats external HardwareUserCancelFromOutside as cancellation', () => {
    expect(
      isPrimeGiftVerifyCancellationError(new UserCancelFromOutside()),
    ).toBe(true);
    expect(
      isPrimeGiftVerifyCancellationError({
        className: EOneKeyErrorClassNames.HardwareUserCancelFromOutside,
        message: 'UserCancelFromOutside',
      }),
    ).toBe(true);
  });

  it('does not treat a plain Device cancelled Error as cancellation', () => {
    expect(
      isPrimeGiftVerifyCancellationError(new Error('Device cancelled')),
    ).toBe(false);
  });

  it('does not treat force-update or passphrase hardware errors as cancellation', () => {
    expect(
      isPrimeGiftVerifyCancellationError(
        convertDeviceError({
          code: HardwareErrorCode.NewFirmwareForceUpdate,
        }),
      ),
    ).toBe(false);
    expect(
      isPrimeGiftVerifyCancellationError(
        convertDeviceError({
          code: HardwareErrorCode.DeviceNotOpenedPassphrase,
        }),
      ),
    ).toBe(false);
  });
});

describe('getPrimeGiftVerifyFailureLogPayload', () => {
  it('does not classify a USB write failure as a read failure', () => {
    expect(
      getPrimeGiftVerifyFailureLogPayload(
        new Error('Protocol V2 USB write failed'),
      ),
    ).toEqual({ reason: 'unknown', errorName: 'Error' });
  });

  it('classifies a leaky USB error without copying sensitive fields', () => {
    const error = Object.assign(
      new Error(leakText('Protocol V2 USB read failed: transferIn')),
      {
        name: `TransportError ${SENSITIVE.serial}`,
        code: SENSITIVE.giftCode,
        requestId: SENSITIVE.userId,
        cause: { message: leakText('usb cause') },
        payload: {
          serialNo: SENSITIVE.serial,
          primeCode: SENSITIVE.giftCode,
          userId: SENSITIVE.userId,
          email: SENSITIVE.email,
          code: SENSITIVE.giftCode,
        },
      },
    );

    const payload = getPrimeGiftVerifyFailureLogPayload(error);
    expect(payload).toEqual({ reason: 'usbReadFailed' });
    expectNoSensitiveValues(payload);
  });

  it('classifies a leaky firmware server error with only allowlisted name and numeric code', () => {
    const error = Object.assign(
      new OneKeyServerApiError({
        code: 500,
        message: leakText('Firmware verification failed'),
        requestId: SENSITIVE.userId,
      }),
      {
        cause: { message: leakText('verify cause') },
        payload: {
          serialNo: SENSITIVE.serial,
          primeCode: SENSITIVE.giftCode,
          code: SENSITIVE.giftCode,
        },
      },
    );

    const payload = getPrimeGiftVerifyFailureLogPayload(error);
    expect(payload).toEqual({
      reason: 'firmwareVerificationFailed',
      errorName: EOneKeyErrorClassNames.OneKeyServerApiError,
      errorCode: 500,
    });
    expectNoSensitiveValues(payload);
  });

  it('classifies a leaky serialized USB object using the Error name allowlist', () => {
    const error = {
      name: 'Error',
      message: leakText('Protocol V2 USB read failed: transferIn'),
      code: SENSITIVE.giftCode,
      requestId: SENSITIVE.userId,
      cause: { message: leakText('serialized usb cause') },
      payload: {
        serialNo: SENSITIVE.serial,
        userId: SENSITIVE.userId,
        email: SENSITIVE.email,
      },
    };

    const payload = getPrimeGiftVerifyFailureLogPayload(error);
    expect(payload).toEqual({
      reason: 'usbReadFailed',
      errorName: 'Error',
    });
    expectNoSensitiveValues(payload);
  });

  it('keeps a known hardware error code and drops free-form identity from unknown failures', () => {
    const error = convertDeviceError({
      code: HardwareErrorCode.RuntimeError,
      error: leakText('RuntimeError'),
    });
    const payload = getPrimeGiftVerifyFailureLogPayload(error);
    expect(payload).toEqual({
      reason: 'unknown',
      errorName: EOneKeyErrorClassNames.UnknownHardwareError,
      errorCode: HardwareErrorCode.RuntimeError,
    });
    expectNoSensitiveValues(payload);
  });
});
