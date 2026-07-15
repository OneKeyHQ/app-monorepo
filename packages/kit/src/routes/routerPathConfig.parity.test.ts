import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import type { IScreenPathConfig } from '@onekeyhq/shared/src/utils/routeUtils';

import { getStateFromPath } from './config/getStateFromPath';
import { resolveScreens } from './config/resolveScreens';
import generatedWebRouteConfig from './generated/routePathConfig.generated.web.json';

import type { IRoutePathConfig } from './routerPathConfig';

jest.mock('./routerPathConfig', () => ({ rootRouterPathConfig: [] }));
jest.mock('./Tab/Navigator', () => ({ TabNavigator: () => null }));
jest.mock('./Tab/router', () => ({ useTabRouterConfig: () => [] }));
jest.mock('@onekeyhq/shared/src/lazyLoad', () => ({
  __esModule: true,
  default: () => () => null,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  isOnBoardingOpenAtom: { set: jest.fn() },
  v4migrationAtom: { set: jest.fn() },
}));
jest.mock(
  '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet',
  () => ({ keylessOnboardingCache: { clear: jest.fn() } }),
);
jest.mock('@onekeyhq/kit/src/components/LazyLoadPage', () => ({
  LazyLoadPage: () => () => null,
  LazyLoadRootTabPage: () => () => null,
}));
jest.mock('@onekeyhq/kit/src/routes/Tab/RootTabLoadingFallback', () => ({
  default: () => null,
  RootTabLoadingFallback: () => null,
}));
jest.mock('@onekeyhq/kit/src/views/Onboardingv2/components/Layout', () => ({
  OnboardingPageFallback: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Onboardingv2/components/OnboardingLayout',
  () => ({ OnboardingLayoutFallback: () => null }),
);
jest.mock('@onekeyhq/kit/src/views/Home/pages/HomePageContainer', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Home/pages/urlAccount/urlAccountUtils',
  () => ({ urlAccountLandingRewrite: '/not-part-of-static-root' }),
);
// Jest does not include Rspack's `.web-only` suffix priority, so mirror it here.
jest.mock('@onekeyhq/kit/src/views/Home/router', () =>
  jest.requireActual<
    typeof import('@onekeyhq/kit/src/views/Home/router/index.web-only')
  >('@onekeyhq/kit/src/views/Home/router/index.web-only'),
);
jest.mock('@onekeyhq/kit/src/views/Onboardingv2/router', () =>
  jest.requireActual<
    typeof import('@onekeyhq/kit/src/views/Onboardingv2/router/index.web-only')
  >('@onekeyhq/kit/src/views/Onboardingv2/router/index.web-only'),
);

interface IGeneratedRouteConfig {
  production: IRoutePathConfig[];
  development: IRoutePathConfig[];
}

const generatedWeb =
  generatedWebRouteConfig as unknown as IGeneratedRouteConfig;

interface IParameterizedRoute {
  names: string[];
  pathPattern: string;
}

interface IParsedRoute {
  name: string;
  params?: Record<string, unknown>;
  state?: IParsedState;
}

interface IParsedState {
  index?: number;
  routes: IParsedRoute[];
}

const normalizeRoutePath = (routePath: string): string =>
  `/${routePath.split('/').filter(Boolean).join('/')}`;

const joinRoutePath = (parentPath: string, routePath: string): string =>
  normalizeRoutePath(`${parentPath}/${routePath}`);

const collectParameterizedRoutes = (
  routes: readonly IRoutePathConfig[],
  parentPath = '',
  parentNames: readonly string[] = [],
): IParameterizedRoute[] =>
  routes.flatMap((route) => {
    const routePath = route.rewrite ?? route.name;
    const fullPath = route.exact
      ? normalizeRoutePath(routePath)
      : joinRoutePath(parentPath, routePath);
    const names = [...parentNames, route.name];
    const current = fullPath.includes(':')
      ? [{ names, pathPattern: fullPath }]
      : [];
    return [
      ...current,
      ...collectParameterizedRoutes(route.children ?? [], fullPath, names),
    ];
  });

const materializePathPattern = (
  pathPattern: string,
): { params: Record<string, string>; path: string } => {
  const params: Record<string, string> = {};
  const path = pathPattern.replace(
    /:([A-Za-z_][A-Za-z0-9_]*)(?:\([^)]*\))?[?*+]?/gu,
    (_match, name: string) => {
      const value = `parity-${name}`;
      params[name] = value;
      return encodeURIComponent(value);
    },
  );
  return { params, path };
};

const getFocusedRouteChain = (
  inputState: unknown,
): { names: string[]; route: IParsedRoute | undefined } => {
  const names: string[] = [];
  let route: IParsedRoute | undefined;
  let state = inputState as IParsedState | undefined;
  while (state) {
    route = state.routes[state.index ?? state.routes.length - 1];
    if (!route) {
      break;
    }
    names.push(route.name);
    state = route.state;
  }
  return { names, route };
};

const projectRouteMetadata = (
  routes: readonly unknown[],
  parentNames: readonly string[] = [],
): IRoutePathConfig[] =>
  routes.map((route, index) => {
    if (!route || typeof route !== 'object') {
      throw new OneKeyLocalError(
        `Runtime route ${[...parentNames, String(index)].join(' > ')} is not an object`,
      );
    }
    const input = route as Record<string, unknown>;
    if (typeof input.name !== 'string') {
      throw new OneKeyLocalError(
        `Runtime route ${[...parentNames, String(index)].join(' > ')} has no static name`,
      );
    }

    const output: IRoutePathConfig = { name: input.name };
    if (Object.hasOwn(input, 'rewrite') && input.rewrite !== undefined) {
      if (typeof input.rewrite !== 'string') {
        throw new OneKeyLocalError(
          `Runtime route ${input.name} has a non-string rewrite`,
        );
      }
      output.rewrite = input.rewrite;
    }
    if (Object.hasOwn(input, 'exact') && input.exact !== undefined) {
      if (typeof input.exact !== 'boolean') {
        throw new OneKeyLocalError(
          `Runtime route ${input.name} has a non-boolean exact`,
        );
      }
      output.exact = input.exact;
    }
    if (Array.isArray(input.children)) {
      output.children = projectRouteMetadata(input.children, [
        ...parentNames,
        input.name,
      ]);
    }
    return output;
  });

const loadRuntimeWebProjection = (isDev: boolean): IRoutePathConfig[] => {
  let projection: IRoutePathConfig[] | undefined;
  const mockedPlatformEnv = {
    ...platformEnv,
    isJest: false,
    isDev,
    isProduction: !isDev,
    isWeb: true,
    isWebEmbed: false,
    isExtension: false,
    isDesktop: false,
    isNative: false,
    isNativeIOS: false,
    isNativeAndroid: false,
    isNativeIOS26Plus: false,
  };

  jest.resetModules();
  jest.doMock('@onekeyhq/shared/src/platformEnv', () => ({
    __esModule: true,
    default: mockedPlatformEnv,
  }));
  jest.isolateModules(() => {
    const { rootRouter } =
      jest.requireActual<typeof import('./router')>('./router');
    const {
      fullModalRouter,
      fullScreenPushRouterConfig,
      modalRouter,
      onboardingRouterV2Config,
    } = jest.requireActual<typeof import('./Modal/router')>('./Modal/router');
    const { webViewRouter } =
      jest.requireActual<typeof import('./WebView/router')>('./WebView/router');

    const childrenByRootRoute = new Map<string, readonly unknown[]>([
      [ERootRoutes.Onboarding, onboardingRouterV2Config],
      [ERootRoutes.Modal, modalRouter],
      [ERootRoutes.iOSFullScreen, fullModalRouter],
      [ERootRoutes.FullScreenPush, fullScreenPushRouterConfig],
      [ERootRoutes.WebView, webViewRouter],
    ]);
    const runtimeRoot = rootRouter.map((route) => {
      const children = childrenByRootRoute.get(route.name);
      return children ? { ...route, children } : route;
    });
    projection = projectRouteMetadata(runtimeRoot);
  });
  jest.dontMock('@onekeyhq/shared/src/platformEnv');

  if (!projection) {
    throw new OneKeyLocalError('Runtime Web route projection was not created');
  }
  return projection;
};

describe('generated Web route config parity', () => {
  it.each([
    ['production', false],
    ['development', true],
  ] as const)(
    'matches the independently executed %s Router projection',
    (mode, isDev) => {
      expect(loadRuntimeWebProjection(isDev)).toEqual(generatedWeb[mode]);
    },
  );

  it.each([['production'], ['development']] as const)(
    'parses every generated %s parameterized path and query parameter',
    (mode) => {
      const routeConfig = generatedWeb[mode];
      const parameterizedRoutes = collectParameterizedRoutes(routeConfig);
      const screens = resolveScreens(routeConfig) as IScreenPathConfig;

      expect(parameterizedRoutes.length).toBeGreaterThan(0);
      for (const parameterizedRoute of parameterizedRoutes) {
        const { params, path } = materializePathPattern(
          parameterizedRoute.pathPattern,
        );
        const state = getStateFromPath(`${path}?parityQuery=route-config`, {
          screens,
        });
        const focused = getFocusedRouteChain(state);
        expect(focused.names).toEqual(parameterizedRoute.names);
        expect(focused.route?.params).toEqual({
          ...params,
          parityQuery: 'route-config',
        });
      }
    },
  );
});
