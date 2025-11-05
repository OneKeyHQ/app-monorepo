import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import type { IDeviceType } from '@onekeyfe/hd-core';
import type { Features } from '@onekeyfe/hd-transport';

// Helper function to convert transport type enum to analytics string
export type IHardwareCommunicationType =
  | 'Bluetooth'
  | 'WebUSB'
  | 'USB'
  | 'QRCode';
// TODO: update this function to use the new transport type
export function getHardwareCommunicationTypeString(
  hardwareTransportType: EHardwareTransportType | undefined | 'QRCode',
): IHardwareCommunicationType {
  if (
    hardwareTransportType === EHardwareTransportType.BLE ||
    hardwareTransportType === EHardwareTransportType.DesktopWebBle
  ) {
    return 'Bluetooth';
  }
  if (hardwareTransportType === EHardwareTransportType.WEBUSB) {
    return 'WebUSB';
  }
  if (hardwareTransportType === 'QRCode') {
    return 'QRCode';
  }
  return platformEnv.isNative ? 'Bluetooth' : 'USB';
}

// Helper function to map user-selected channel to forced transport type
export async function getForceTransportType(
  channel: EConnectDeviceChannel,
): Promise<EHardwareTransportType | undefined> {
  switch (channel) {
    case EConnectDeviceChannel.bluetooth:
      return platformEnv.isSupportDesktopBle
        ? EHardwareTransportType.DesktopWebBle
        : EHardwareTransportType.BLE;
    case EConnectDeviceChannel.usbOrBle: {
      // For usbOrBle, constrain based on platform
      if (platformEnv.isNative) return EHardwareTransportType.BLE;
      if (platformEnv.isDesktop) {
        const dev = await backgroundApiProxy.serviceDevSetting.getDevSetting();
        const usbCommunicationMode = dev?.settings?.usbCommunicationMode;
        if (usbCommunicationMode === 'bridge')
          return EHardwareTransportType.Bridge;
        return EHardwareTransportType.WEBUSB;
      }
      // For web/extension, use system setting transport type
      const currentTransportType =
        await backgroundApiProxy.serviceSetting.getHardwareTransportType();
      return currentTransportType;
    }
    case EConnectDeviceChannel.qr:
      // QR code doesn't use hardware transport
      return undefined;
    default:
      return undefined;
  }
}

export const trackHardwareWalletConnection = async ({
  status,
  deviceType,
  isSoftwareWalletOnlyUser,
  features,
  hardwareTransportType,
}: {
  status: 'success' | 'failure';
  deviceType: IDeviceType;
  isSoftwareWalletOnlyUser: boolean;
  features?: Features;
  hardwareTransportType: EHardwareTransportType | undefined | 'QRCode';
}) => {
  const connectionType: IHardwareCommunicationType =
    getHardwareCommunicationTypeString(hardwareTransportType);

  const firmwareVersions = features
    ? await deviceUtils.getDeviceVersion({
        device: undefined,
        features,
      })
    : undefined;

  defaultLogger.account.wallet.walletAdded({
    status,
    addMethod: 'ConnectHWWallet',
    details: {
      hardwareWalletType: 'Standard',
      communication: connectionType,
      deviceType,
      ...(firmwareVersions && { firmwareVersions }),
    },
    isSoftwareWalletOnlyUser,
  });
};
