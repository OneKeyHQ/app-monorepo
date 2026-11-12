import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  ForbiddenKeyPathError,
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

  it('reads a path the device cannot derive as an unsupported address type', () => {
    const message = 'Non-hardened paths unsupported on Ed25519';
    const error = convertDeviceError({
      code: HardwareErrorCode.DeviceNotSupportPath,
      error: message,
    });
    expect(error).toBeInstanceOf(UnsupportedAddressTypeError);
    expect(error.code).toBe(HardwareErrorCode.DeviceNotSupportPath);
    // Kept for logs and reports, though the user sees the translated text.
    expect(error.payload).toMatchObject({ message });
  });

  it('reads a path the safety checks refuse as a forbidden key path', () => {
    const error = convertDeviceError({
      code: HardwareErrorCode.ForbiddenKeyPath,
      error: 'Forbidden key path',
    });
    expect(error).toBeInstanceOf(ForbiddenKeyPathError);
    expect(error.code).toBe(HardwareErrorCode.ForbiddenKeyPath);
  });
});
