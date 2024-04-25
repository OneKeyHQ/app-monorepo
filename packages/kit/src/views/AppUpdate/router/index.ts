import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IAppUpdatePagesParamList } from '@onekeyhq/shared/src/routes';
import { EAppUpdateRoutes } from '@onekeyhq/shared/src/routes';

const UpdatePreview = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/AppUpdate/pages/UpdatePreview'),
);

const WhatsNew = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/AppUpdate/pages/WhatsNew'),
);

export const AppUpdateRouter: IModalFlowNavigatorConfig<
  EAppUpdateRoutes,
  IAppUpdatePagesParamList
>[] = [
  {
    name: EAppUpdateRoutes.UpdatePreview,
    component: UpdatePreview,
  },
  {
    name: EAppUpdateRoutes.WhatsNew,
    component: WhatsNew,
  },
];
