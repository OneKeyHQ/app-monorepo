import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  isBluetoothFirmwareUpdateTransport,
  shouldSuggestDesktopUsbFirmwareUpdate,
} from './firmwareUpdateTransportUtils';

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

describe('shouldSuggestDesktopUsbFirmwareUpdate', () => {
  it.each([EDeviceType.Pro, EDeviceType.Pro2, EDeviceType.Neo])(
    'suggests desktop USB for %s on native',
    (deviceType) => {
      expect(
        shouldSuggestDesktopUsbFirmwareUpdate({ isNative: true, deviceType }),
      ).toBe(true);
    },
  );

  it.each([
    EDeviceType.Classic,
    EDeviceType.Classic1s,
    EDeviceType.ClassicPure,
    EDeviceType.Mini,
    EDeviceType.Touch,
    EDeviceType.Unknown,
    undefined,
  ])('leaves %s on the plain Bluetooth flow on native', (deviceType) => {
    expect(
      shouldSuggestDesktopUsbFirmwareUpdate({ isNative: true, deviceType }),
    ).toBe(false);
  });

  it.each([
    { isNative: false, deviceType: EDeviceType.Pro },
    { isNative: false, deviceType: EDeviceType.Pro2 },
    { isNative: false, deviceType: EDeviceType.Neo },
    { isNative: undefined, deviceType: EDeviceType.Pro },
    { isNative: undefined, deviceType: EDeviceType.Pro2 },
    { isNative: undefined, deviceType: EDeviceType.Neo },
  ])(
    'never suggests it off native ($deviceType, isNative: $isNative)',
    (params) => {
      expect(shouldSuggestDesktopUsbFirmwareUpdate(params)).toBe(false);
    },
  );
});
