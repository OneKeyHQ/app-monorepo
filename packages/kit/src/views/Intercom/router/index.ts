import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { EIntercomRoutes } from '@onekeyhq/shared/src/routes/intercom';
import type { IIntercomParamList } from '@onekeyhq/shared/src/routes/intercom';

const SupportHome = LazyLoadPage(() => import('../pages/SupportHome'));
const SupportMessages = LazyLoadPage(() => import('../pages/SupportMessages'));
const SupportHelp = LazyLoadPage(() => import('../pages/SupportHelp'));
const SupportConversation = LazyLoadPage(
  () => import('../pages/SupportConversation'),
);

export const IntercomRouter: IModalFlowNavigatorConfig<
  EIntercomRoutes,
  IIntercomParamList
>[] = [
  {
    name: EIntercomRoutes.Home,
    component: SupportHome,
    modalContentMaxWidth: 420,
    modalContentMaxHeight: 740,
  },
  {
    name: EIntercomRoutes.Messages,
    component: SupportMessages,
    modalContentMaxWidth: 420,
    modalContentMaxHeight: 740,
  },
  {
    name: EIntercomRoutes.Help,
    component: SupportHelp,
    modalContentMaxWidth: 420,
    modalContentMaxHeight: 740,
  },
  {
    name: EIntercomRoutes.Conversation,
    component: SupportConversation,
    modalContentMaxWidth: 420,
    modalContentMaxHeight: 740,
  },
];
