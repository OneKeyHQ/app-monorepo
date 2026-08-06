import { EHardwareTransportType } from '@onekeyhq/shared/types';

import type { SearchDevice } from '@onekeyfe/hd-core';

/**
 * 按用户实际选中的设备解析创建钱包所使用的 transport。
 * 全局设置只是默认值；OneKey 使用搜索结果的 commType，第三方设备使用
 * raw.connectionType。这样即使 USB/BLE 合并列表与全局设置不同，也不会把
 * USB serial 写入 bleConnectId，或把 BLE 外设 ID 写入 usbConnectId。
 */
export function resolveHwWalletTransportType(params: {
  globalTransportType: EHardwareTransportType;
  deviceConnectionType: 'usb' | 'ble' | undefined;
  deviceCommType?: SearchDevice['commType'];
  isNative: boolean;
}): EHardwareTransportType {
  const {
    globalTransportType,
    deviceConnectionType,
    deviceCommType,
    isNative,
  } = params;
  let commTypeConnectionType: 'usb' | 'ble' | undefined;
  if (
    deviceCommType === 'ble' ||
    deviceCommType === 'webble' ||
    deviceCommType === 'electron-ble'
  ) {
    commTypeConnectionType = 'ble';
  } else if (
    deviceCommType === 'usb' ||
    deviceCommType === 'webusb' ||
    deviceCommType === 'bridge'
  ) {
    commTypeConnectionType = 'usb';
  }
  const actualConnectionType = deviceConnectionType ?? commTypeConnectionType;
  const globalIsUsb =
    globalTransportType === EHardwareTransportType.WEBUSB ||
    globalTransportType === EHardwareTransportType.Bridge;
  const globalIsBle =
    globalTransportType === EHardwareTransportType.BLE ||
    globalTransportType === EHardwareTransportType.DesktopWebBle;
  if (actualConnectionType === 'ble' && globalIsUsb) {
    return isNative
      ? EHardwareTransportType.BLE
      : EHardwareTransportType.DesktopWebBle;
  }
  if (actualConnectionType === 'usb' && globalIsBle && !isNative) {
    return EHardwareTransportType.WEBUSB;
  }
  return globalTransportType;
}
