import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';

import type { ICustomInjectedModalParamList } from './customInjectedModalRoutes';
import { ECustomInjectedModalRoutes } from './customInjectedModalRoutes';

const CustomInjectedProtocolListModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Discovery/pages/CustomInjectedProtocolListModal'),
);

const CustomInjectedE2EWorkflowModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Discovery/pages/CustomInjectedE2EWorkflowModal'),
);

const CustomInjectedE2EErrorDetailModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Discovery/pages/CustomInjectedE2EErrorDetailModal'),
);

const CustomInjectedOperationLogModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Discovery/pages/CustomInjectedOperationLogModal'),
);

export const developmentDesktopModalRoutes: IModalFlowNavigatorConfig<
  ECustomInjectedModalRoutes,
  ICustomInjectedModalParamList
>[] = [
  {
    name: ECustomInjectedModalRoutes.ProtocolList,
    component: CustomInjectedProtocolListModal,
  },
  {
    name: ECustomInjectedModalRoutes.E2EWorkflow,
    component: CustomInjectedE2EWorkflowModal,
  },
  {
    name: ECustomInjectedModalRoutes.E2EErrorDetail,
    component: CustomInjectedE2EErrorDetailModal,
  },
  {
    name: ECustomInjectedModalRoutes.OperationLogs,
    component: CustomInjectedOperationLogModal,
  },
];
