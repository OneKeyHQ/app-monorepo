import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  DESKTOP_USB_SUGGESTION_MIN_TRANSFER_BYTES,
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
  // The 1.0.3 resource refresh of the Pro 2 family (~18 MB archive plus the
  // firmware components) and a routine SafeOS update (a few MB).
  const largeUpdate = 22_000_000;
  const routineUpdate = 2_500_000;

  it.each([EDeviceType.Pro, EDeviceType.Pro2, EDeviceType.Neo])(
    'suggests desktop USB for a large %s update on native',
    (deviceType) => {
      expect(
        shouldSuggestDesktopUsbFirmwareUpdate({
          isNative: true,
          deviceType,
          estimatedTransferBytes: largeUpdate,
        }),
      ).toBe(true);
    },
  );

  it.each([EDeviceType.Pro, EDeviceType.Pro2, EDeviceType.Neo])(
    'leaves a routine %s update on the plain Bluetooth flow',
    (deviceType) => {
      expect(
        shouldSuggestDesktopUsbFirmwareUpdate({
          isNative: true,
          deviceType,
          estimatedTransferBytes: routineUpdate,
        }),
      ).toBe(false);
    },
  );

  it.each([
    [DESKTOP_USB_SUGGESTION_MIN_TRANSFER_BYTES, false],
    [DESKTOP_USB_SUGGESTION_MIN_TRANSFER_BYTES + 1, true],
    [undefined, false],
  ])(
    'with %s bytes asks: %s (strictly above the threshold, never unknown)',
    (estimatedTransferBytes, expected) => {
      expect(
        shouldSuggestDesktopUsbFirmwareUpdate({
          isNative: true,
          deviceType: EDeviceType.Pro2,
          estimatedTransferBytes,
        }),
      ).toBe(expected);
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
  ])(
    'leaves %s on the plain Bluetooth flow whatever the size',
    (deviceType) => {
      expect(
        shouldSuggestDesktopUsbFirmwareUpdate({
          isNative: true,
          deviceType,
          estimatedTransferBytes: largeUpdate,
        }),
      ).toBe(false);
    },
  );

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
      expect(
        shouldSuggestDesktopUsbFirmwareUpdate({
          ...params,
          estimatedTransferBytes: largeUpdate,
        }),
      ).toBe(false);
    },
  );
});
