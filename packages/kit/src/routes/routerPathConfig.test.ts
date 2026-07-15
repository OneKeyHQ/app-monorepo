/** @jest-environment jsdom */

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EAppUpdateRoutes,
  EDAppConnectionModal,
  EModalRoutes,
  EModalSettingRoutes,
  EModalSignatureConfirmRoutes,
  EModalStakingRoutes,
  EOnboardingPagesV2,
  ERootRoutes,
  onboardingV2RouteConfig,
} from '@onekeyhq/shared/src/routes';
import {
  appUpdateRouteManifest,
  bindRouteManifest,
  dAppConnectionRouteManifest,
  filterRouteManifestByPresentation,
  fullScreenPushRouteManifest,
  modalRouteManifest,
  onboardingRouteManifest,
  projectColdStartRouteManifest,
  rootRouteManifest,
  settingRouteManifest,
  signatureConfirmRouteManifest,
  stakingRouteManifest,
  webViewRouteManifest,
} from '@onekeyhq/shared/src/routes/routeManifest';
import type { IScreenPathConfig } from '@onekeyhq/shared/src/utils/routeUtils';

import { getStateFromPath as getWebStateFromPath } from './config/getStateFromPath';
import { getStateFromPath as getExtensionStateFromPath } from './config/getStateFromPath.ext';
import { resolveScreens } from './config/resolveScreens';
import {
  fullModalRouterPathConfig,
  fullScreenPushRouterPathConfig,
  modalRouterPathConfig,
  onboardingRouterV2PathConfig,
  webViewRouterPathConfig,
} from './routerPathConfig';

import type { NavigationState, PartialState } from '@react-navigation/routers';

type IPartialNavigationState = PartialState<NavigationState>;

const screens = resolveScreens([
  {
    name: ERootRoutes.Onboarding,
    children: onboardingRouterV2PathConfig,
  },
]) as IScreenPathConfig;

const allRootScreens = resolveScreens([
  {
    name: ERootRoutes.Onboarding,
    children: onboardingRouterV2PathConfig,
  },
  {
    name: ERootRoutes.Modal,
    children: modalRouterPathConfig,
  },
  {
    name: ERootRoutes.iOSFullScreen,
    children: fullModalRouterPathConfig,
  },
  {
    name: ERootRoutes.FullScreenPush,
    children: fullScreenPushRouterPathConfig,
  },
  {
    name: ERootRoutes.WebView,
    children: webViewRouterPathConfig,
  },
]) as IScreenPathConfig;

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

describe('onboardingRouterV2PathConfig', () => {
  afterEach(() => {
    globalThis.location.hash = '';
  });

  it('derives the public cold-start routes from the full route definition', () => {
    const onboardingRoute = onboardingRouterV2PathConfig[0];

    expect(onboardingRoute.children?.map((route) => route.name)).toEqual([
      EOnboardingPagesV2.GetStarted,
      EOnboardingPagesV2.CreateNewWallet,
      EOnboardingPagesV2.CreateOrImportWallet,
      EOnboardingPagesV2.PickYourDevice,
    ]);
    expect(onboardingV2RouteConfig.children.map((route) => route.name)).toEqual(
      Object.values(EOnboardingPagesV2),
    );
    expect(onboardingV2RouteConfig.children[0]?.name).toBe(
      EOnboardingPagesV2.GetStarted,
    );
    expect(Object.isFrozen(onboardingV2RouteConfig)).toBe(true);
    expect(Object.isFrozen(onboardingV2RouteConfig.children)).toBe(true);
    expect(Object.isFrozen(onboardingV2RouteConfig.children[0])).toBe(true);
  });

  it('parses PickYourDevice into the complete Web navigation state', () => {
    const state = getWebStateFromPath('/onboarding/PickYourDevice', {
      screens,
    });

    expect(getFocusedRouteNames(state)).toEqual([
      ERootRoutes.Onboarding,
      onboardingV2RouteConfig.name,
      EOnboardingPagesV2.PickYourDevice,
    ]);
  });

  it('parses PickYourDevice from the real extension hash parser', () => {
    const state = parseExtensionHash('#/onboarding/PickYourDevice');

    expect(getFocusedRouteNames(state)).toEqual([
      ERootRoutes.Onboarding,
      onboardingV2RouteConfig.name,
      EOnboardingPagesV2.PickYourDevice,
    ]);
  });

  it.each([
    '/onboarding/ConnectYourDevice',
    '/onboarding/CheckAndUpdate',
    '/onboarding/ShowRecoveryPhrase',
    '/onboarding/VerifyRecoveryPhrase?walletId=hd-1',
    '/onboarding/UnknownPage',
  ])('rejects non-public Web cold-start path %s', (path) => {
    expect(getWebStateFromPath(path, { screens })).toBeUndefined();
  });

  it.each([
    '#/onboarding/ConnectYourDevice',
    '#/onboarding/CheckAndUpdate',
    '#/onboarding/ShowRecoveryPhrase',
    '#/onboarding/VerifyRecoveryPhrase?walletId=hd-1',
    '#/onboarding/UnknownPage',
  ])('rejects non-public extension cold-start hash %s', (hash) => {
    expect(parseExtensionHash(hash)).toBeUndefined();
  });
});

describe('route manifests', () => {
  it('covers every configured route domain from a pure manifest', () => {
    expect(rootRouteManifest.map((route) => route.name)).toEqual([
      ERootRoutes.Main,
      ERootRoutes.Onboarding,
      ERootRoutes.Modal,
      ERootRoutes.iOSFullScreen,
      ERootRoutes.FullScreenPush,
      ERootRoutes.WebView,
    ]);
    expect(modalRouteManifest.map((route) => route.name)).toEqual(
      Object.values(EModalRoutes),
    );
    expect(settingRouteManifest.map((route) => route.name)).toEqual(
      Object.values(EModalSettingRoutes),
    );
    expect(appUpdateRouteManifest.map((route) => route.name)).toEqual(
      Object.values(EAppUpdateRoutes),
    );
    expect(stakingRouteManifest.map((route) => route.name)).toEqual(
      Object.values(EModalStakingRoutes),
    );
    expect(signatureConfirmRouteManifest.map((route) => route.name)).toEqual(
      Object.values(EModalSignatureConfirmRoutes),
    );
    expect(dAppConnectionRouteManifest.map((route) => route.name)).toEqual(
      Object.values(EDAppConnectionModal).filter(
        (name) => name !== EDAppConnectionModal.VerifyMessage,
      ),
    );
  });

  it('projects every lightweight root domain from the same manifests', () => {
    const activeModalManifest = modalRouteManifest.filter(
      (route) => platformEnv.isDev || route.name !== EModalRoutes.TestModal,
    );

    expect(modalRouterPathConfig).toEqual(
      projectColdStartRouteManifest(
        filterRouteManifestByPresentation(activeModalManifest, 'modal'),
      ),
    );
    expect(fullModalRouterPathConfig).toEqual(
      projectColdStartRouteManifest(
        filterRouteManifestByPresentation(activeModalManifest, 'iosFullScreen'),
      ),
    );
    expect(onboardingRouterV2PathConfig).toEqual(
      projectColdStartRouteManifest(onboardingRouteManifest),
    );
    expect(fullScreenPushRouterPathConfig).toEqual(
      projectColdStartRouteManifest(fullScreenPushRouteManifest),
    );
    expect(webViewRouterPathConfig).toEqual(
      projectColdStartRouteManifest(webViewRouteManifest),
    );
  });

  it('binds UI config without changing route order or path metadata', () => {
    const bindings = [
      { name: EAppUpdateRoutes.WhatsNew, component: 'whats-new' },
      { name: EAppUpdateRoutes.UpdatePreview, component: 'preview' },
      { name: EAppUpdateRoutes.DownloadVerify, component: 'verify' },
      { name: EAppUpdateRoutes.ManualInstall, component: 'install' },
      {
        name: EAppUpdateRoutes.FeaturedChangelogPreview,
        component: 'changelog',
      },
    ];

    const routes = bindRouteManifest(appUpdateRouteManifest, bindings);

    expect(routes.map((route) => route.name)).toEqual(
      bindings.map((route) => route.name),
    );
    expect(routes[1]).toMatchObject({
      component: 'preview',
      rewrite: '/preview',
    });
  });

  it('rejects missing bindings and duplicated path metadata', () => {
    expect(() =>
      bindRouteManifest(appUpdateRouteManifest, [
        { name: EAppUpdateRoutes.UpdatePreview },
      ]),
    ).toThrow('Missing route binding');

    expect(() =>
      bindRouteManifest(appUpdateRouteManifest, [
        {
          name: EAppUpdateRoutes.UpdatePreview,
          rewrite: '/duplicated-preview',
        },
        { name: EAppUpdateRoutes.WhatsNew },
        { name: EAppUpdateRoutes.DownloadVerify },
        { name: EAppUpdateRoutes.ManualInstall },
        { name: EAppUpdateRoutes.FeaturedChangelogPreview },
      ]),
    ).toThrow('Route path metadata must be declared in the manifest');
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
  ])(
    'parses cold-start path %s across every root route domain',
    (path, names) => {
      const state = getWebStateFromPath(path, {
        screens: allRootScreens,
      });

      expect(getFocusedRouteNames(state)).toEqual(names);
    },
  );
});
