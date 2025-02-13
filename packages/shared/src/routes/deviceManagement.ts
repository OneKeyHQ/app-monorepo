export enum EModalDeviceManagementRoutes {
  GuideModal = 'GuideModal',
  DeviceListModal = 'DeviceListModal',
  DeviceDetailModal = 'DeviceDetailModal',
  BuyOneKeyHardwareWallet = 'BuyOneKeyHardwareWallet',
}

export type IModalDeviceManagementParamList = {
  [EModalDeviceManagementRoutes.GuideModal]: undefined;
  [EModalDeviceManagementRoutes.DeviceListModal]: undefined;
  [EModalDeviceManagementRoutes.DeviceDetailModal]: {
    walletId: string;
  };
  [EModalDeviceManagementRoutes.BuyOneKeyHardwareWallet]: undefined;
};
