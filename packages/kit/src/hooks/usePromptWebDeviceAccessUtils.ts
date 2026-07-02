import { ONEKEY_WEBUSB_FILTER } from '@onekeyfe/hd-shared';
import { TREZOR_WEBUSB_FILTERS } from '@onekeyfe/hwk-trezor-connector-webusb/constants';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

export function getWebUsbDeviceFilters(vendor?: EHardwareVendor) {
  if (vendor === EHardwareVendor.trezor) {
    return TREZOR_WEBUSB_FILTERS;
  }
  return ONEKEY_WEBUSB_FILTER;
}

export function isWebUsbNoDeviceSelectedError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const webUsbError = error as {
    code?: unknown;
    message?: unknown;
    name?: unknown;
  };

  if (webUsbError.name === 'NotFoundError' || webUsbError.code === 8) {
    return true;
  }

  return (
    typeof webUsbError.message === 'string' &&
    webUsbError.message.includes('No device selected')
  );
}
