import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import type { IThirdPartyConnectedDevicePayload } from '@onekeyhq/kit-bg/src/services/ServiceHardware/adapters/types';

type IKeystoneUsbConnectResult =
  | { success: true; payload: IThirdPartyConnectedDevicePayload }
  | { success: false; payload: unknown };

/** Returns the USB result, or undefined after QR wallet creation completes. */
export async function connectKeystoneUsbOrCreateQrWallet({
  connectUsb,
  createQrWallet,
  isCurrentAttempt,
}: {
  connectUsb: () => Promise<IKeystoneUsbConnectResult>;
  createQrWallet: () => Promise<unknown>;
  isCurrentAttempt: () => boolean;
}): Promise<IKeystoneUsbConnectResult | undefined> {
  const connected = await connectUsb();
  if (!isCurrentAttempt() || connected.success) return connected;

  const error = connected.payload;
  const code =
    error && typeof error === 'object' && 'code' in error
      ? error.code
      : undefined;
  // USB enumeration also finds firmware that cannot communicate over USB.
  // Only connection failures fall back; cancellation and device answers stay errors.
  if (
    code === HardwareErrorCode.OperationTimeout ||
    code === HardwareErrorCode.DeviceNotFound ||
    code === HardwareErrorCode.DeviceDisconnected ||
    code === HardwareErrorCode.TransportError ||
    code === HardwareErrorCode.TransportNotAvailable
  ) {
    await createQrWallet();
    return undefined;
  }
  return connected;
}
