import { ONEKEY_WEBUSB_FILTER } from '@onekeyfe/hd-shared';
import { TREZOR_WEBUSB_FILTERS } from '@onekeyfe/hwk-trezor-connector-webusb';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { getWebUsbDeviceFilters } from './usePromptWebDeviceAccessUtils';

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
