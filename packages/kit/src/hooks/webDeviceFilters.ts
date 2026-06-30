import { EHardwareVendor } from '@onekeyhq/shared/types/device';

export const ONEKEY_WEBUSB_FILTERS: USBDeviceFilter[] = [
  { vendorId: 0x12_09, productId: 0x53_c0 },
  { vendorId: 0x12_09, productId: 0x53_c1 },
  { vendorId: 0x12_09, productId: 0x4f_4a },
  { vendorId: 0x12_09, productId: 0x4f_4b },
];

export const TREZOR_WEBUSB_FILTERS: USBDeviceFilter[] = [
  { vendorId: 0x12_09, productId: 0x53_c1 },
  { vendorId: 0x12_09, productId: 0x53_c0 },
];

export function getWebUsbDeviceFilters(vendor?: EHardwareVendor) {
  if (vendor === EHardwareVendor.trezor) {
    return TREZOR_WEBUSB_FILTERS;
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
  return [...ONEKEY_WEBUSB_FILTERS, ...TREZOR_WEBUSB_FILTERS].some((filter) =>
    matchesUsbFilter(device, filter),
  );
}
