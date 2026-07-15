import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  filterRouteManifestByPresentation,
  fullScreenPushRouteManifest,
  modalRouteManifest,
  onboardingRouteManifest,
  projectColdStartRouteManifest,
  webViewRouteManifest,
} from '@onekeyhq/shared/src/routes/routeManifest';
import type { IRoutePathConfig } from '@onekeyhq/shared/src/routes/routeManifest';

export type { IRoutePathConfig };

const activeModalRouteManifest = modalRouteManifest.filter(
  (entry) => platformEnv.isDev || entry.name !== EModalRoutes.TestModal,
);

export const modalRouterPathConfig: IRoutePathConfig[] =
  projectColdStartRouteManifest(
    filterRouteManifestByPresentation(activeModalRouteManifest, 'modal'),
  );

export const fullModalRouterPathConfig: IRoutePathConfig[] =
  projectColdStartRouteManifest(
    filterRouteManifestByPresentation(
      activeModalRouteManifest,
      'iosFullScreen',
    ),
  );

export const fullScreenPushRouterPathConfig: IRoutePathConfig[] =
  projectColdStartRouteManifest(fullScreenPushRouteManifest);

export const onboardingRouterV2PathConfig: IRoutePathConfig[] =
  projectColdStartRouteManifest(onboardingRouteManifest);

export const webViewRouterPathConfig: IRoutePathConfig[] =
  projectColdStartRouteManifest(webViewRouteManifest);
