import { preloadLazyTooltip } from '@onekeyhq/components';
import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IModalDeviceManagementParamList } from '@onekeyhq/shared/src/routes';
import { EModalDeviceManagementRoutes } from '@onekeyhq/shared/src/routes';

// The list loads with the tooltip its add shortcuts use: a lazy one swaps in
// on the first keyboard focus and remounts the focused button.
const DeviceListModal = LazyLoadPage(() =>
  Promise.all([
    import('../pages/DeviceManagementListModal'),
    preloadLazyTooltip().catch(() => undefined),
  ]).then(([page]) => page),
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
