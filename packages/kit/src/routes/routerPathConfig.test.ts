/** @jest-environment jsdom */

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EAppUpdateRoutes,
  EDAppConnectionModal,
  EModalRoutes,
  EModalSettingRoutes,
  EModalSignatureConfirmRoutes,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IScreenPathConfig } from '@onekeyhq/shared/src/utils/routeUtils';

import { getStateFromPath as getWebStateFromPath } from './config/getStateFromPath';
import { getStateFromPath as getExtensionStateFromPath } from './config/getStateFromPath.ext';
import { resolveScreens } from './config/resolveScreens';
import {
  type IRoutePathConfig,
  modalRouterPathConfig,
  onboardingRouterV2PathConfig,
  rootRouterPathConfig,
} from './routerPathConfig';

import type { NavigationState, PartialState } from '@react-navigation/routers';

type IPartialNavigationState = PartialState<NavigationState>;

const screens = resolveScreens(rootRouterPathConfig) as IScreenPathConfig;

const getFocusedRouteNames = (
  state: IPartialNavigationState | undefined,
): string[] => {
  const routeNames: string[] = [];
  let currentState = state;

  while (currentState) {
    const route =
      currentState.routes[currentState.index ?? currentState.routes.length - 1];
    if (!route) {
      break;
    }
    routeNames.push(route.name);
    currentState = route.state as IPartialNavigationState | undefined;
  }

  return routeNames;
};

const parseExtensionHash = (hash: string) => {
  globalThis.location.hash = hash;
  return getExtensionStateFromPath(hash, { screens });
};

const findRoute = (
  routes: IRoutePathConfig[],
  ...names: string[]
): IRoutePathConfig | undefined => {
  let currentRoutes = routes;
  let current: IRoutePathConfig | undefined;
  for (const name of names) {
    current = currentRoutes.find((route) => route.name === name);
    if (!current) {
      return undefined;
    }
    currentRoutes = current.children ?? [];
  }
  return current;
};

const countRoutes = (routes: IRoutePathConfig[]): number =>
  routes.reduce(
    (total, route) => total + 1 + countRoutes(route.children ?? []),
    0,
  );

describe('generated cold-start route config', () => {
  afterEach(() => {
    globalThis.location.hash = '';
  });

  it('contains the complete registered root graph without UI metadata', () => {
    expect(rootRouterPathConfig.slice(0, 6).map((route) => route.name)).toEqual(
      [
        ERootRoutes.Main,
        ERootRoutes.Onboarding,
        ERootRoutes.Modal,
        ERootRoutes.iOSFullScreen,
        ERootRoutes.FullScreenPush,
        ERootRoutes.WebView,
      ],
    );
    expect(countRoutes(rootRouterPathConfig)).toBeGreaterThan(400);

    const visit = (routes: IRoutePathConfig[]) => {
      for (const route of routes) {
        expect(Object.keys(route)).toEqual(expect.arrayContaining(['name']));
        expect(
          Object.keys(route).every((key) =>
            ['name', 'rewrite', 'exact', 'children'].includes(key),
          ),
        ).toBe(true);
        visit(route.children ?? []);
      }
    };
    visit(rootRouterPathConfig);
  });

  it('derives every onboarding page from the full navigator', () => {
    const onboardingRoute = onboardingRouterV2PathConfig[0];
    const pageNames =
      onboardingRoute?.children?.map((route) => route.name) ?? [];

    expect(onboardingRoute).toMatchObject({
      name: EOnboardingV2Routes.OnboardingV2,
      rewrite: '/onboarding',
      exact: true,
    });
    expect(pageNames).toHaveLength(Object.values(EOnboardingPagesV2).length);
    expect(new Set(pageNames)).toEqual(
      new Set(Object.values(EOnboardingPagesV2)),
    );
    expect(onboardingRoute?.children?.[0]).toMatchObject({
      name: EOnboardingPagesV2.GetStarted,
      rewrite: '/get-started',
    });
  });

  it('keeps development-only modal routes aligned with the full router', () => {
    const modalNames = modalRouterPathConfig.map((route) => route.name);
    const expectedNames = Object.values(EModalRoutes).filter(
      (name) => platformEnv.isDev || name !== EModalRoutes.TestModal,
    );

    expect(modalNames).toHaveLength(expectedNames.length);
    expect(new Set(modalNames)).toEqual(new Set(expectedNames));
  });

  it.each([
    EOnboardingPagesV2.PickYourDevice,
    EOnboardingPagesV2.ConnectYourDevice,
    EOnboardingPagesV2.CheckAndUpdate,
    EOnboardingPagesV2.ShowRecoveryPhrase,
    EOnboardingPagesV2.VerifyRecoveryPhrase,
  ])(
    'parses registered onboarding page %s as a Web URL and extension hash',
    (page) => {
      const path = `/onboarding/${page}`;
      const expected = [
        ERootRoutes.Onboarding,
        EOnboardingV2Routes.OnboardingV2,
        page,
      ];

      expect(
        getFocusedRouteNames(getWebStateFromPath(path, { screens })),
      ).toEqual(expected);
      expect(getFocusedRouteNames(parseExtensionHash(`#${path}`))).toEqual(
        expected,
      );
    },
  );

  it('rejects an unregistered onboarding page', () => {
    expect(
      getWebStateFromPath('/onboarding/UnknownPage', { screens }),
    ).toBeUndefined();
    expect(parseExtensionHash('#/onboarding/UnknownPage')).toBeUndefined();
  });

  it.each([
    [
      '/settings/protection',
      [
        ERootRoutes.Modal,
        EModalRoutes.SettingModal,
        EModalSettingRoutes.SettingProtectModal,
      ],
    ],
    [
      '/modal/update/preview',
      [
        ERootRoutes.Modal,
        EModalRoutes.AppUpdateModal,
        EAppUpdateRoutes.UpdatePreview,
      ],
    ],
    [
      '/modal/DAppConnectionModal/ConnectionModal',
      [
        ERootRoutes.Modal,
        EModalRoutes.DAppConnectionModal,
        EDAppConnectionModal.ConnectionModal,
      ],
    ],
    [
      '/iOSFullScreen/SignatureConfirmModal/TxConfirmFromDApp',
      [
        ERootRoutes.iOSFullScreen,
        EModalRoutes.SignatureConfirmModal,
        EModalSignatureConfirmRoutes.TxConfirmFromDApp,
      ],
    ],
    [
      '/fullScreenPush/ActionCenter/ActionCenter',
      [ERootRoutes.FullScreenPush, 'ActionCenter', 'ActionCenter'],
    ],
    [
      '/RootWebView/WebView/WebView',
      [ERootRoutes.WebView, 'WebView', 'WebView'],
    ],
  ])('parses cold-start path %s across root domains', (path, names) => {
    expect(
      getFocusedRouteNames(getWebStateFromPath(path, { screens })),
    ).toEqual(names);
  });

  it('contains deep routes that were previously omitted by manual projection', () => {
    expect(
      findRoute(
        rootRouterPathConfig,
        ERootRoutes.Modal,
        EModalRoutes.SettingModal,
        EModalSettingRoutes.SettingProtectModal,
      ),
    ).toBeDefined();
    expect(
      findRoute(
        rootRouterPathConfig,
        ERootRoutes.Modal,
        EModalRoutes.DAppConnectionModal,
        EDAppConnectionModal.ConnectionModal,
      ),
    ).toBeDefined();
  });
});
