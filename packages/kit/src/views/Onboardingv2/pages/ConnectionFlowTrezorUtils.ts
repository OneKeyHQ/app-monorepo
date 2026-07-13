import { EHardwareTransportType } from '@onekeyhq/shared/types';

export {
  TREZOR_SCAN_MAX_TRY_COUNT,
  TREZOR_SCAN_POLL_INTERVAL_MS,
  shouldShowTrezorScanTimeout,
} from '../../../components/Hardware/trezorScanUtils';

export function getTrezorSearchTransportType(
  forceTransportType: EHardwareTransportType | undefined,
): 'usb' | 'ble' | undefined {
  if (
    forceTransportType === EHardwareTransportType.BLE ||
    forceTransportType === EHardwareTransportType.DesktopWebBle
  ) {
    return 'ble';
  }

  if (
    forceTransportType === EHardwareTransportType.WEBUSB ||
    forceTransportType === EHardwareTransportType.Bridge
  ) {
    return undefined;
  }

  return undefined;
}

export function shouldRequestTrezorWebUsbPermissionBeforeListing({
  isDesktop: _isDesktop,
  isExtension,
}: {
  isDesktop: boolean;
  isExtension: boolean;
}) {
  return isExtension;
}
