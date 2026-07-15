import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import type {
  EModalAddressBookRoutes,
  IModalAddressBookParamList,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import {
  bindRouteManifest,
  settingRouteManifest,
} from '@onekeyhq/shared/src/routes/routeManifest';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

// WARNING:
// If global jotai data is modified, this page will re-render when using lazy loading, so it must be statically imported.
// Static import to avoid React Native re-rendering issues when jotai global data is modified
import { BasicModalSettingStack } from './basicModalSettingRouter';
import { SettingListSubModal } from './settingListSubModalRoute';

const SettingTabModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Setting/pages/Tab'),
);

const settingRouteBindings: IModalFlowNavigatorConfig<
  EModalSettingRoutes | EModalAddressBookRoutes,
  IModalSettingParamList & IModalAddressBookParamList
>[] = [
  {
    name: EModalSettingRoutes.SettingListModal,
    component: SettingTabModal,
    options: {
      headerShown: false,
    },
  },
  {
    name: EModalSettingRoutes.SettingListSubModal,
    component: SettingListSubModal,
  },
  ...BasicModalSettingStack,
];

export const ModalSettingStack = bindRouteManifest(
  settingRouteManifest,
  settingRouteBindings,
  { allowUnknownBindings: true },
);
