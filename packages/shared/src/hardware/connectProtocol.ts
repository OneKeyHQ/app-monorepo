import { EDeviceType, HARDWARE_CONNECT_PROTOCOL } from '@onekeyfe/hd-shared';

import type { HardwareConnectProtocol } from '@onekeyfe/hd-shared';

type IProtocolAwareDevice = {
  protocolType?: unknown;
  deviceType?: unknown;
  name?: unknown;
};

export function getHardwareConnectProtocolFromDeviceType(
  deviceType?: unknown,
): HardwareConnectProtocol | undefined {
  if (deviceType === EDeviceType.Pro2) {
    return HARDWARE_CONNECT_PROTOCOL.V2;
  }
  return undefined;
}

export function getHardwareConnectProtocolFromDevice(
  device?: object | null,
): HardwareConnectProtocol | undefined {
  const protocolType = (device as IProtocolAwareDevice | undefined)
    ?.protocolType;
  if (
    protocolType === HARDWARE_CONNECT_PROTOCOL.V1 ||
    protocolType === HARDWARE_CONNECT_PROTOCOL.V2
  ) {
    return protocolType;
  }
  const deviceName = (device as IProtocolAwareDevice | undefined)?.name;
  if (typeof deviceName === 'string' && /\bPro\s*2\b/i.test(deviceName)) {
    return HARDWARE_CONNECT_PROTOCOL.V2;
  }
  return getHardwareConnectProtocolFromDeviceType(
    (device as IProtocolAwareDevice | undefined)?.deviceType,
  );
}

export function isHardwareConnectProtocolV2Device(
  device?: object | null,
): boolean {
  return (
    getHardwareConnectProtocolFromDevice(device) ===
    HARDWARE_CONNECT_PROTOCOL.V2
  );
}
