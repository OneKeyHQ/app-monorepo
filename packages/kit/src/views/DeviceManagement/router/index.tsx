import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IModalDeviceManagementParamList } from '@onekeyhq/shared/src/routes';
import { EModalDeviceManagementRoutes } from '@onekeyhq/shared/src/routes/deviceManagement';

const DeviceGuideModal = LazyLoadPage(
  () => import('../pages/DeviceGuideModal'),
);

const DeviceListModal = LazyLoadPage(
  () => import('../pages/DeviceManagementListModal'),
);

// const DeviceDetailModal = LazyLoadPage(
//   () => import('../pages/DeviceDetailModal'),
// );

export const DeviceManagementStacks: IModalFlowNavigatorConfig<
  EModalDeviceManagementRoutes,
  IModalDeviceManagementParamList
>[] = [
  {
    name: EModalDeviceManagementRoutes.GuideModal,
    component: DeviceGuideModal,
  },
  {
    name: EModalDeviceManagementRoutes.DeviceListModal,
    component: DeviceListModal,
  },
  // {
  //   name: EModalDeviceManagementRoutes.DeviceDetailModal,
  //   component: DeviceDetailModal,
  // },
];
