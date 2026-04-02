import type { IHwQrWalletWithDevice } from '../../types/account';

export enum EModalDeviceManagementRoutes {
  DeviceListModal = 'DeviceListModal',
  DeviceDetailModal = 'DeviceDetailModal',
  BuyOneKeyHardwareWallet = 'BuyOneKeyHardwareWallet',
  HardwareTroubleshootingModal = 'HardwareTroubleshootingModal',
}

export type IModalDeviceManagementParamList = {
  [EModalDeviceManagementRoutes.DeviceListModal]: undefined;
  [EModalDeviceManagementRoutes.DeviceDetailModal]: {
    walletId: string;
  };
  [EModalDeviceManagementRoutes.BuyOneKeyHardwareWallet]: undefined;
  [EModalDeviceManagementRoutes.HardwareTroubleshootingModal]: {
    walletWithDevice: IHwQrWalletWithDevice;
  };
};
