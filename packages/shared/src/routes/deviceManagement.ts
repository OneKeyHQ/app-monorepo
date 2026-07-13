import type { IHwQrWalletWithDevice } from '../../types/account';
import type { EHardwareVendor } from '../../types/device';

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
    initialDeviceVendor?: EHardwareVendor;
  };
  [EModalDeviceManagementRoutes.BuyOneKeyHardwareWallet]: undefined;
  [EModalDeviceManagementRoutes.HardwareTroubleshootingModal]: {
    walletWithDevice: IHwQrWalletWithDevice;
  };
};
