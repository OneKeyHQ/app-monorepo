import {
  EModalDeviceManagementRoutes,
  EModalRoutes,
  ERootRoutes,
  ETabDeviceManagementRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

import useAppNavigation from '../../../hooks/useAppNavigation';

import { useDeviceManagerModalStyle } from './useDeviceManagerModalStyle';

export const useDeviceManagerNavigation = () => {
  const navigation = useAppNavigation();
  const { isModalStack } = useDeviceManagerModalStyle();

  const pushToDeviceList = () => {
    if (isModalStack) {
      navigation.pushModal(EModalRoutes.DeviceManagementModal, {
        screen: EModalDeviceManagementRoutes.DeviceListModal,
      });
    } else {
      navigation.push(ERootRoutes.Main, {
        screen: ETabRoutes.DeviceManagement,
      });
    }
  };

  const pushToDeviceDetail = (params: { walletId: string }) => {
    if (isModalStack) {
      navigation.pushModal(EModalRoutes.DeviceManagementModal, {
        screen: EModalDeviceManagementRoutes.DeviceDetailModal,
        params,
      });
    } else {
      navigation.navigate(ERootRoutes.Main, {
        screen: ETabRoutes.DeviceManagement,
        params: {
          screen: ETabDeviceManagementRoutes.DeviceDetail,
          params,
        },
      });
    }
  };

  const pushToTroubleshooting = (params: {
    walletWithDevice: IHwQrWalletWithDevice;
  }) => {
    navigation.pushModal(EModalRoutes.DeviceManagementModal, {
      screen: EModalDeviceManagementRoutes.HardwareTroubleshootingModal,
      params,
    });
  };

  const pushToBuyHardware = () => {
    if (isModalStack) {
      navigation.pushModal(EModalRoutes.DeviceManagementModal, {
        screen: EModalDeviceManagementRoutes.BuyOneKeyHardwareWallet,
      });
    } else {
      navigation.navigate(ERootRoutes.Main, {
        screen: ETabRoutes.DeviceManagement,
        params: {
          screen: ETabDeviceManagementRoutes.BuyOneKeyHardwareWallet,
        },
      });
    }
  };

  return {
    pushToDeviceList,
    pushToDeviceDetail,
    pushToTroubleshooting,
    pushToBuyHardware,
  };
};
