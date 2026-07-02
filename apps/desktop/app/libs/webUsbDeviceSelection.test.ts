import { shouldGrantMainWindowDevicePermission } from './webUsbDeviceSelection';

describe('webUsbDeviceSelection', () => {
  it('keeps device permission scoped to USB and Ledger HID', () => {
    expect(
      shouldGrantMainWindowDevicePermission({
        deviceType: 'usb',
        device: { vendorId: 0x12_09 },
      }),
    ).toBe(true);
    expect(
      shouldGrantMainWindowDevicePermission({
        deviceType: 'hid',
        device: { vendorId: 0x2c_97 },
      }),
    ).toBe(true);
    expect(
      shouldGrantMainWindowDevicePermission({
        deviceType: 'hid',
        device: { vendorId: 0x12_09 },
      }),
    ).toBe(false);
  });
});
