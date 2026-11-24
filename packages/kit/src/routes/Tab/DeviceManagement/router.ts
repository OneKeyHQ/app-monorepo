import { createElement } from 'react';

import { preloadLazyTooltip } from '@onekeyhq/components';
import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabDeviceManagementRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';
import { DeviceDetailsRouteFallback } from '../../../views/DeviceManagement/pages/DeviceDetailsModal/DeviceDetailsFrame';
import { DeviceListRouteFallback } from '../../../views/DeviceManagement/pages/DeviceManagementListModal/DeviceListFrame';

// While a page's code loads, its own frame and placeholder stand in for it.
// The list also loads the tooltip its add shortcuts use: a lazy one swaps in
// on the first keyboard focus and remounts the focused button.
const DeviceList = LazyLoadRootTabPage(
  () =>
    Promise.all([
      import('../../../views/DeviceManagement/pages/DeviceManagementListModal'),
      preloadLazyTooltip().catch(() => undefined),
    ]).then(([page]) => page),
  createElement(DeviceListRouteFallback),
);

const DeviceDetail = LazyLoadRootTabPage(
  () => import('../../../views/DeviceManagement/pages/DeviceDetailsModal'),
  createElement(DeviceDetailsRouteFallback),
);

const HardwareTroubleshooting = LazyLoadRootTabPage(
  () =>
    import('../../../views/DeviceManagement/pages/HardwareTroubleshootingModal'),
);

const BuyOneKeyHardwareWallet = LazyLoadRootTabPage(
  () =>
    import('@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/OneKeyHardwareWallet'),
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
