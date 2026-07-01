import { ONEKEY_WEBUSB_FILTER } from '@onekeyfe/hd-shared';
import { TREZOR_WEBUSB_FILTERS } from '@onekeyfe/hwk-trezor-connector-webusb';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  getWebUsbDeviceFilters,
  isWebUsbNoDeviceSelectedError,
} from './usePromptWebDeviceAccessUtils';

describe('getWebUsbDeviceFilters', () => {
  it('uses Trezor WebUSB filters for Trezor devices', () => {
    expect(getWebUsbDeviceFilters(EHardwareVendor.trezor)).toBe(
      TREZOR_WEBUSB_FILTERS,
    );
  });

  it('keeps OneKey WebUSB filters as the default', () => {
    expect(getWebUsbDeviceFilters()).toBe(ONEKEY_WEBUSB_FILTER);
    expect(getWebUsbDeviceFilters(EHardwareVendor.onekey)).toBe(
      ONEKEY_WEBUSB_FILTER,
    );
  });
});

describe('isWebUsbNoDeviceSelectedError', () => {
  it('detects cancelled WebUSB device picker errors', () => {
    expect(
      isWebUsbNoDeviceSelectedError({
        name: 'NotFoundError',
        code: 8,
        message:
          "Failed to execute 'requestDevice' on 'USB': No device selected.",
      }),
    ).toBe(true);
  });

  it('does not classify unrelated errors as picker cancellation', () => {
    expect(isWebUsbNoDeviceSelectedError(new Error('USB unavailable'))).toBe(
      false,
    );
  });
});
