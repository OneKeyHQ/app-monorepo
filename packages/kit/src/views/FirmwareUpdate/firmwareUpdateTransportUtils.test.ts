import { isBluetoothFirmwareUpdateTransport } from './firmwareUpdateTransportUtils';

describe('isBluetoothFirmwareUpdateTransport', () => {
  it('treats native transport as Bluetooth', () => {
    expect(
      isBluetoothFirmwareUpdateTransport({
        isNative: true,
      }),
    ).toBe(true);
  });

  it('keeps desktop firmware updates on the USB checklist', () => {
    expect(
      isBluetoothFirmwareUpdateTransport({
        isNative: false,
      }),
    ).toBe(false);
  });
});
