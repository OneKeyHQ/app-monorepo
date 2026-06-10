import { ONEKEY_WEBUSB_FILTER } from '@onekeyfe/hd-shared';
import { TREZOR_WEBUSB_FILTERS } from '@onekeyfe/hwk-trezor-connector-webusb/constants';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

export function getWebUsbDeviceFilters(vendor?: EHardwareVendor) {
  if (vendor === EHardwareVendor.trezor) {
    return TREZOR_WEBUSB_FILTERS;
  }
  return ONEKEY_WEBUSB_FILTER;
}
