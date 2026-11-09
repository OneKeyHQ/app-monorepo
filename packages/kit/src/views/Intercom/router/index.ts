import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { EIntercomRoutes } from '@onekeyhq/shared/src/routes/intercom';
import type { IIntercomParamList } from '@onekeyhq/shared/src/routes/intercom';

const SupportScreen = LazyLoadPage(() => import('../pages/SupportScreen'));

export const IntercomRouter: IModalFlowNavigatorConfig<
  EIntercomRoutes,
  IIntercomParamList
>[] = [
  {
    name: EIntercomRoutes.Home,
    component: SupportScreen,
    modalContentMaxWidth: 420,
    modalContentMaxHeight: 740,
  },
  {
    name: EIntercomRoutes.Messages,
    component: SupportScreen,
    modalContentMaxWidth: 420,
    modalContentMaxHeight: 740,
  },
  {
    name: EIntercomRoutes.Help,
    component: SupportScreen,
    modalContentMaxWidth: 420,
    modalContentMaxHeight: 740,
  },
  {
    name: EIntercomRoutes.Conversation,
    component: SupportScreen,
    modalContentMaxWidth: 420,
    modalContentMaxHeight: 740,
  },
];
