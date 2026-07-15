import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';

import generatedRoutePathConfig from './generated/routePathConfig.generated';

export interface IRoutePathConfig {
  name: string;
  rewrite?: string;
  exact?: boolean;
  children?: IRoutePathConfig[];
}

interface IGeneratedRoutePathConfig {
  schemaVersion: 1;
  target: string;
  sourceHash: string;
  production: IRoutePathConfig[];
  development: IRoutePathConfig[];
}

const generated =
  generatedRoutePathConfig as unknown as IGeneratedRoutePathConfig;

export const rootRouterPathConfig: IRoutePathConfig[] = platformEnv.isDev
  ? generated.development
  : generated.production;

const getRootChildren = (name: ERootRoutes): IRoutePathConfig[] =>
  rootRouterPathConfig.find((route) => route.name === name)?.children ?? [];

export const modalRouterPathConfig = getRootChildren(ERootRoutes.Modal);
export const fullModalRouterPathConfig = getRootChildren(
  ERootRoutes.iOSFullScreen,
);
export const fullScreenPushRouterPathConfig = getRootChildren(
  ERootRoutes.FullScreenPush,
);
export const onboardingRouterV2PathConfig = getRootChildren(
  ERootRoutes.Onboarding,
);
export const webViewRouterPathConfig = getRootChildren(ERootRoutes.WebView);
