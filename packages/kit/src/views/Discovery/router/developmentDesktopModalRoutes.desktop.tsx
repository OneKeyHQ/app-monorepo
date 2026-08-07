import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes/discovery.desktop';
import { EDiscoveryModalRoutes } from '@onekeyhq/shared/src/routes/discovery.desktop';

const CustomInjectedProtocolListModal = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Discovery/pages/CustomInjectedProtocolListModal'),
);

const CustomInjectedE2EWorkflowModal = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Discovery/pages/CustomInjectedE2EWorkflowModal'),
);

const CustomInjectedE2EErrorDetailModal = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Discovery/pages/CustomInjectedE2EErrorDetailModal'),
);

const CustomInjectedOperationLogModal = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Discovery/pages/CustomInjectedOperationLogModal'),
);

export const developmentDesktopModalRoutes: IModalFlowNavigatorConfig<
  EDiscoveryModalRoutes,
  IDiscoveryModalParamList
>[] = [
  {
    name: EDiscoveryModalRoutes.CustomInjectedProtocolList,
    component: CustomInjectedProtocolListModal,
  },
  {
    name: EDiscoveryModalRoutes.CustomInjectedE2EWorkflow,
    component: CustomInjectedE2EWorkflowModal,
  },
  {
    name: EDiscoveryModalRoutes.CustomInjectedE2EErrorDetail,
    component: CustomInjectedE2EErrorDetailModal,
  },
  {
    name: EDiscoveryModalRoutes.CustomInjectedOperationLogs,
    component: CustomInjectedOperationLogModal,
  },
];
