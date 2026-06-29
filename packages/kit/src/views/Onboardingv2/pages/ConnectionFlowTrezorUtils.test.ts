import { EHardwareTransportType } from '@onekeyhq/shared/types';

import {
  TREZOR_SCAN_MAX_TRY_COUNT,
  TREZOR_SCAN_POLL_INTERVAL_MS,
  getTrezorSearchTransportType,
  shouldRequestTrezorWebUsbPermissionBeforeListing,
  shouldShowTrezorScanTimeout,
} from './ConnectionFlowTrezorUtils';

describe('ConnectionFlowTrezorUtils', () => {
  it('maps forced transport to third-party search transport', () => {
    expect(getTrezorSearchTransportType(EHardwareTransportType.BLE)).toBe(
      'ble',
    );
    expect(
      getTrezorSearchTransportType(EHardwareTransportType.DesktopWebBle),
    ).toBe('ble');
    expect(getTrezorSearchTransportType(EHardwareTransportType.WEBUSB)).toBe(
      'usb',
    );
    expect(getTrezorSearchTransportType(EHardwareTransportType.Bridge)).toBe(
      'usb',
    );
    expect(getTrezorSearchTransportType(undefined)).toBeUndefined();
  });

  it('requests WebUSB permission before listing on desktop or extension UI', () => {
    expect(
      shouldRequestTrezorWebUsbPermissionBeforeListing({
        isDesktop: false,
        isExtension: true,
      }),
    ).toBe(true);

    expect(
      shouldRequestTrezorWebUsbPermissionBeforeListing({
        isDesktop: true,
        isExtension: false,
      }),
    ).toBe(true);

    expect(
      shouldRequestTrezorWebUsbPermissionBeforeListing({
        isDesktop: false,
        isExtension: false,
      }),
    ).toBe(false);
  });

  it('keeps Trezor scan bounded and only times out when no device is found', () => {
    expect(TREZOR_SCAN_MAX_TRY_COUNT).toBe(14);
    expect(TREZOR_SCAN_POLL_INTERVAL_MS).toBe(1500);

    expect(
      shouldShowTrezorScanTimeout({
        pollsCompleted: TREZOR_SCAN_MAX_TRY_COUNT - 1,
        deviceCount: 0,
      }),
    ).toBe(false);

    expect(
      shouldShowTrezorScanTimeout({
        pollsCompleted: TREZOR_SCAN_MAX_TRY_COUNT,
        deviceCount: 0,
      }),
    ).toBe(true);

    expect(
      shouldShowTrezorScanTimeout({
        pollsCompleted: TREZOR_SCAN_MAX_TRY_COUNT,
        deviceCount: 1,
      }),
    ).toBe(false);
  });
});
