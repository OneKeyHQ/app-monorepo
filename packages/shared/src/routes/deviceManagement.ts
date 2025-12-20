import type { IHwQrWalletWithDevice } from '../../types/account';

export enum EModalDeviceManagementRoutes {
  GuideModal = 'GuideModal',
  DeviceListModal = 'DeviceListModal',
  DeviceDetailModal = 'DeviceDetailModal',
  BuyOneKeyHardwareWallet = 'BuyOneKeyHardwareWallet',
  HardwareTroubleshootingModal = 'HardwareTroubleshootingModal',
}

export type IModalDeviceManagementParamList = {
  [EModalDeviceManagementRoutes.GuideModal]: undefined;
  [EModalDeviceManagementRoutes.DeviceListModal]: undefined;
  [EModalDeviceManagementRoutes.DeviceDetailModal]: {
    walletId: string;
  };
  [EModalDeviceManagementRoutes.BuyOneKeyHardwareWallet]: undefined;
  [EModalDeviceManagementRoutes.HardwareTroubleshootingModal]: {
    walletWithDevice: IHwQrWalletWithDevice;
  };
};
