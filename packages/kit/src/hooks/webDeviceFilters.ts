import { ONEKEY_WEBUSB_FILTER } from '@onekeyfe/hd-shared';
import { TREZOR_WEBUSB_FILTERS as HARDWARE_TREZOR_WEBUSB_FILTERS } from '@onekeyfe/hwk-trezor-connector-webusb';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

export const ONEKEY_WEBUSB_FILTERS = ONEKEY_WEBUSB_FILTER as USBDeviceFilter[];
export const TREZOR_WEBUSB_FILTERS = HARDWARE_TREZOR_WEBUSB_FILTERS;
// Mirrors keystoneUSBVendorId/ProductId (4617/12289), inlined since the
// connector package doesn't re-export them. 0x1209 is a shared pid.codes VID, so both fields must match; VID alone isn't Keystone.
export const KEYSTONE_WEBUSB_FILTERS: USBDeviceFilter[] = [
  { vendorId: 0x12_09, productId: 0x30_01 },
];

export function getWebUsbDeviceFilters(vendor?: EHardwareVendor) {
  if (vendor === EHardwareVendor.trezor) {
    return TREZOR_WEBUSB_FILTERS;
  }
  if (vendor === EHardwareVendor.keystone) {
    return KEYSTONE_WEBUSB_FILTERS;
  }
  return ONEKEY_WEBUSB_FILTERS;
}

function matchesUsbFilter(
  device: Pick<USBDevice, 'productId' | 'vendorId'>,
  filter: USBDeviceFilter,
): boolean {
  if (filter.vendorId !== undefined && filter.vendorId !== device.vendorId) {
    return false;
  }
  if (filter.productId !== undefined && filter.productId !== device.productId) {
    return false;
  }
  return true;
}

export function isSupportedHardwareWebUsbDevice(
  device: Pick<USBDevice, 'productId' | 'vendorId'>,
): boolean {
  return [
    ...ONEKEY_WEBUSB_FILTERS,
    ...TREZOR_WEBUSB_FILTERS,
    ...KEYSTONE_WEBUSB_FILTERS,
  ].some((filter) => matchesUsbFilter(device, filter));
}
