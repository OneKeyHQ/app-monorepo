import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import type {
  EModalAddressBookRoutes,
  IModalAddressBookParamList,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';
import SettingListSubModal from '../pages/Tab/SettingListSubModal';

import { BasicModalSettingStack } from './basicModalSettingRouter';

const SettingTabModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Setting/pages/Tab'),
);

export const ModalSettingStack: IModalFlowNavigatorConfig<
  EModalSettingRoutes | EModalAddressBookRoutes,
  IModalSettingParamList & IModalAddressBookParamList
>[] = [
  {
    name: EModalSettingRoutes.SettingListModal,
    component: SettingTabModal,
    rewrite: '/',
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
