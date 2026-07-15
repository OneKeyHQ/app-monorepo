import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IAppUpdatePagesParamList } from '@onekeyhq/shared/src/routes';
import { EAppUpdateRoutes } from '@onekeyhq/shared/src/routes';
import {
  appUpdateRouteManifest,
  bindRouteManifest,
} from '@onekeyhq/shared/src/routes/routeManifest';

const UpdatePreview = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/AppUpdate/pages/UpdatePreview'),
);

const WhatsNew = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/AppUpdate/pages/WhatsNew'),
);

const DownloadVerify = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/AppUpdate/pages/DownloadVerify'),
);

const ManualInstall = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/AppUpdate/pages/ManualInstall'),
);

const appUpdateRouteBindings: IModalFlowNavigatorConfig<
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
  {
    name: EAppUpdateRoutes.DownloadVerify,
    component: DownloadVerify,
  },
  {
    name: EAppUpdateRoutes.ManualInstall,
    component: ManualInstall,
  },
];

export const AppUpdateRouter = bindRouteManifest(
  appUpdateRouteManifest,
  appUpdateRouteBindings,
);
