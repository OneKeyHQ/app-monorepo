import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IModalNotificationsParamList } from '@onekeyhq/shared/src/routes/notifications';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';

const NotificationList = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Notifications/pages/NotificationList'),
);

const NotificationIntroduction = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Notifications/pages/NotificationIntroduction'
    ),
);

export const ModalNotificationsRouter: IModalFlowNavigatorConfig<
  EModalNotificationsRoutes,
  IModalNotificationsParamList
>[] = [
  {
    name: EModalNotificationsRoutes.NotificationList,
    component: NotificationList,
  },

  {
    name: EModalNotificationsRoutes.NotificationIntroduction,
    component: NotificationIntroduction,
  },
];
