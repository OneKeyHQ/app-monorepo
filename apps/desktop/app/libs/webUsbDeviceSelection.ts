const LEDGER_USB_VENDOR_ID = 0x2c_97;

type IDevicePermissionDetails = {
  device?: {
    vendorId?: number | string;
  };
  deviceType?: string;
};

export function shouldGrantMainWindowDevicePermission(
  details: IDevicePermissionDetails,
) {
  if (details.deviceType === 'usb') {
    return true;
  }
  if (details.deviceType === 'hid') {
    return Number(details.device?.vendorId) === LEDGER_USB_VENDOR_ID;
  }
  return false;
}
