import { useEffect, useState } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';

const USB_PERMISSION_DENIED_CODES = new Set<number>([
  HardwareErrorCode.BridgeNeedsPermission,
  HardwareErrorCode.WebDeviceNotFoundOrNeedsPermission,
  HardwareErrorCode.WebUsbDeviceAccessError,
]);

const USB_PERMISSION_DENIED_MESSAGE_RE =
  /usb.*permission|permission.*denied|user denied|permission not granted|device access not granted/i;

export function isAndroidUsbPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const errObj = error as {
    code?: unknown;
    errorCode?: unknown;
    message?: unknown;
    error?: unknown;
  };
  const numericCode = Number(errObj.code ?? errObj.errorCode);
  if (
    Number.isFinite(numericCode) &&
    USB_PERMISSION_DENIED_CODES.has(numericCode)
  ) {
    return true;
  }
  const text = [errObj.message, errObj.error]
    .filter((item): item is string => typeof item === 'string')
    .join(' ');
  return USB_PERMISSION_DENIED_MESSAGE_RE.test(text);
}

export async function resolveNativeForceTransportType(
  channel: EConnectDeviceChannel,
): Promise<EHardwareTransportType> {
  if (channel === EConnectDeviceChannel.bluetooth) {
    return EHardwareTransportType.BLE;
  }
  if (platformEnv.isNativeAndroid) {
    const serviceSetting = backgroundApiProxy?.serviceSetting as
      | {
          isAndroidUsbAutoEnabled?: () => Promise<boolean>;
          getHardwareTransportType?: () => Promise<EHardwareTransportType>;
        }
      | undefined;
    if (typeof serviceSetting?.isAndroidUsbAutoEnabled === 'function') {
      return (await serviceSetting.isAndroidUsbAutoEnabled())
        ? EHardwareTransportType.NativeUsb
        : EHardwareTransportType.BLE;
    }
    const currentTransportType =
      await serviceSetting?.getHardwareTransportType?.();
    return currentTransportType === EHardwareTransportType.NativeUsb
      ? EHardwareTransportType.NativeUsb
      : EHardwareTransportType.BLE;
  }
  return EHardwareTransportType.BLE;
}

export function useAndroidUsbAutoEnabled(isFocused = true): boolean {
  // Fail closed: show the Bluetooth flow until the service confirms that
  // automatic USB is available (SDK support + kill-switch off).
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!platformEnv.isNativeAndroid) {
      setEnabled(false);
      return;
    }
    if (!isFocused) {
      return;
    }
    let active = true;
    const serviceSetting = backgroundApiProxy?.serviceSetting as
      | { isAndroidUsbAutoEnabled?: () => Promise<boolean> }
      | undefined;
    if (typeof serviceSetting?.isAndroidUsbAutoEnabled === 'function') {
      void serviceSetting
        .isAndroidUsbAutoEnabled()
        .then((result) => {
          if (active) {
            setEnabled(Boolean(result));
          }
        })
        .catch(() => {
          if (active) {
            setEnabled(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [isFocused]);

  return platformEnv.isNativeAndroid ? enabled : false;
}
