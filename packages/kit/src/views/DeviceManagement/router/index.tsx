import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IModalDeviceManagementParamList } from '@onekeyhq/shared/src/routes';
import { EModalDeviceManagementRoutes } from '@onekeyhq/shared/src/routes';

const DeviceListModal = LazyLoadPage(
  () => import('../pages/DeviceManagementListModal'),
);

const DeviceDetailModal = LazyLoadPage(
  () => import('../pages/DeviceDetailsModal'),
);

const BuyOneKeyHardwareWallet = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/OneKeyHardwareWallet'),
);

const HardwareTroubleshootingModal = LazyLoadPage(
  () => import('../pages/HardwareTroubleshootingModal'),
);

export const DeviceManagementStacks: IModalFlowNavigatorConfig<
  EModalDeviceManagementRoutes,
  IModalDeviceManagementParamList
>[] = [
  {
    name: EModalDeviceManagementRoutes.DeviceListModal,
    component: DeviceListModal,
  },
  {
    name: EModalDeviceManagementRoutes.DeviceDetailModal,
    component: DeviceDetailModal,
  },
  {
    name: EModalDeviceManagementRoutes.BuyOneKeyHardwareWallet,
    component: BuyOneKeyHardwareWallet,
    options: {
      headerShown: false,
    },
  },
  {
    name: EModalDeviceManagementRoutes.HardwareTroubleshootingModal,
    component: HardwareTroubleshootingModal,
  },
];
