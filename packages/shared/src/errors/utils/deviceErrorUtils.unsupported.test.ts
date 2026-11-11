import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  UnknownMethod,
  UnsupportedAddressTypeError,
} from '../errors/hardwareErrors';

import { convertDeviceError } from './deviceErrorUtils';

describe('convertDeviceError for what the firmware does not support', () => {
  it.each([
    // Classic, Classic 1S and Mini.
    'Failure_UnexpectedMessage,Unknown message',
    // Pro 2.
    'Failure_ProcessError,Handler not found: No handler for type: 12400',
  ])('reads %s as an operation the firmware lacks', (message) => {
    const error = convertDeviceError({
      code: HardwareErrorCode.RuntimeError,
      error: message,
      message,
    });
    expect(error).toBeInstanceOf(UnknownMethod);
  });

  it('reads an Ed25519 path the device refuses as an unsupported address type', () => {
    const message =
      'Failure_DataError,Non-hardened paths unsupported on Ed25519';
    const error = convertDeviceError({
      code: HardwareErrorCode.RuntimeError,
      error: message,
      message,
    });
    expect(error).toBeInstanceOf(UnsupportedAddressTypeError);
    // Kept for logs and reports, though the user sees the translated text.
    expect(error.payload).toMatchObject({ message });
  });
});
