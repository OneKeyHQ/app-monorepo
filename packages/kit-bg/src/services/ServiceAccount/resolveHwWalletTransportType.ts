import { EHardwareTransportType } from '@onekeyhq/shared/types';

/**
 * 与 x 分支保持一致：OneKey 创建流程沿用 Onboarding 已选定的全局
 * transport；第三方融合设备列表使用 raw.connectionType 修正实际通道。
 */
export function resolveHwWalletTransportType(params: {
  globalTransportType: EHardwareTransportType;
  deviceConnectionType: 'usb' | 'ble' | undefined;
  isNative: boolean;
}): EHardwareTransportType {
  const { globalTransportType, deviceConnectionType, isNative } = params;
  const globalIsUsb =
    globalTransportType === EHardwareTransportType.WEBUSB ||
    globalTransportType === EHardwareTransportType.Bridge;
  const globalIsBle =
    globalTransportType === EHardwareTransportType.BLE ||
    globalTransportType === EHardwareTransportType.DesktopWebBle;
  if (deviceConnectionType === 'ble' && globalIsUsb) {
    return isNative
      ? EHardwareTransportType.BLE
      : EHardwareTransportType.DesktopWebBle;
  }
  if (deviceConnectionType === 'usb' && globalIsBle && !isNative) {
    return EHardwareTransportType.WEBUSB;
  }
  return globalTransportType;
}
