import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabDeviceManagementRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';

const DeviceList = LazyLoadRootTabPage(
  () =>
    import('../../../views/DeviceManagement/pages/DeviceManagementListModal'),
);

const DeviceDetail = LazyLoadRootTabPage(
  () => import('../../../views/DeviceManagement/pages/DeviceDetailsModal'),
);

const HardwareTroubleshooting = LazyLoadRootTabPage(
  () =>
    import(
      '../../../views/DeviceManagement/pages/HardwareTroubleshootingModal'
    ),
);

const BuyOneKeyHardwareWallet = LazyLoadRootTabPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/OneKeyHardwareWallet'
    ),
);

export const deviceManagementRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabDeviceManagementRoutes.DeviceList,
    component: DeviceList,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabDeviceManagementRoutes.DeviceDetail,
    component: DeviceDetail,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabDeviceManagementRoutes.BuyOneKeyHardwareWallet,
    component: BuyOneKeyHardwareWallet,
    headerShown: false,
  },
  {
    name: ETabDeviceManagementRoutes.HardwareTroubleshooting,
    component: HardwareTroubleshooting,
    headerShown: !platformEnv.isNative,
  },
];
