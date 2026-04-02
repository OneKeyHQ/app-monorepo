import type { IHwQrWalletWithDevice } from '../../types/account';

export enum ETabDeviceManagementRoutes {
  GuideModal = 'GuideModal',
  DeviceList = 'DeviceList',
  DeviceDetail = 'DeviceDetail',
  BuyOneKeyHardwareWallet = 'BuyOneKeyHardwareWallet',
  HardwareTroubleshooting = 'HardwareTroubleshooting',
}

export type ITabDeviceManagementParamList = {
  [ETabDeviceManagementRoutes.GuideModal]: undefined;
  [ETabDeviceManagementRoutes.DeviceList]: undefined;
  [ETabDeviceManagementRoutes.DeviceDetail]: {
    walletId: string;
  };
  [ETabDeviceManagementRoutes.BuyOneKeyHardwareWallet]: undefined;
  [ETabDeviceManagementRoutes.HardwareTroubleshooting]: {
    walletWithDevice: IHwQrWalletWithDevice;
  };
};
