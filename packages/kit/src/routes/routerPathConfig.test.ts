/** @jest-environment jsdom */

import fs from 'node:fs';
import nodePath from 'node:path';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EAppUpdateRoutes,
  EDAppConnectionModal,
  EModalReferFriendsRoutes,
  EModalRewardCenterRoutes,
  EModalRoutes,
  EModalSettingRoutes,
  EModalSignatureConfirmRoutes,
  EModalStakingRoutes,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
  ETestModalPages,
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
const extensionRootRouterPathConfig = (
  JSON.parse(
    fs.readFileSync(
      nodePath.join(
        __dirname,
        'generated/routePathConfig.generated.ext.production.json',
      ),
      'utf8',
    ),
  ) as { routes: IRoutePathConfig[] }
).routes;
const extensionScreens = resolveScreens(
  extensionRootRouterPathConfig,
) as IScreenPathConfig;

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
  return getExtensionStateFromPath(hash, { screens: extensionScreens });
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

  it('contains only explicit inbound routes without UI metadata', () => {
    expect(rootRouterPathConfig.map((route) => route.name)).toEqual([
      ERootRoutes.Main,
      ERootRoutes.Onboarding,
      ERootRoutes.Modal,
      ...(platformEnv.isDev ? [ERootRoutes.NotFound] : []),
    ]);
    expect(countRoutes(rootRouterPathConfig)).toBe(platformEnv.isDev ? 27 : 24);

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

  it('keeps only explicitly allowed onboarding pages', () => {
    const onboardingRoute = onboardingRouterV2PathConfig[0];
    const pageNames =
      onboardingRoute?.children?.map((route) => route.name) ?? [];

    expect(onboardingRoute).toMatchObject({
      name: EOnboardingV2Routes.OnboardingV2,
      rewrite: '/onboarding',
      exact: true,
    });
    expect(pageNames).toEqual([
      EOnboardingPagesV2.GetStarted,
      EOnboardingPagesV2.CreateNewWallet,
      EOnboardingPagesV2.CreateOrImportWallet,
      EOnboardingPagesV2.PickYourDevice,
    ]);
    expect(onboardingRoute?.children?.[0]).toMatchObject({
      name: EOnboardingPagesV2.GetStarted,
      rewrite: '/get-started',
    });
  });

  it('contains only explicitly allowed Web modal stacks', () => {
    const modalNames = modalRouterPathConfig.map((route) => route.name);
    expect(modalNames).toEqual([
      EModalRoutes.MainModal,
      EModalRoutes.SettingModal,
      EModalRoutes.SignatureConfirmModal,
      EModalRoutes.AppUpdateModal,
      EModalRoutes.StakingModal,
      EModalRoutes.ReferFriendsModal,
      ...(platformEnv.isDev ? [EModalRoutes.TestModal] : []),
    ]);
  });

  it.each([
    [EOnboardingPagesV2.GetStarted, '/onboarding/get-started'],
    [EOnboardingPagesV2.CreateNewWallet, '/onboarding/create-new-wallet'],
    [
      EOnboardingPagesV2.CreateOrImportWallet,
      '/onboarding/create-or-import-wallet',
    ],
    [EOnboardingPagesV2.PickYourDevice, '/onboarding/PickYourDevice'],
  ])(
    'parses registered onboarding page %s as a Web URL and extension hash',
    (page, path) => {
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

  it.each([
    EOnboardingPagesV2.ConnectYourDevice,
    EOnboardingPagesV2.CheckAndUpdate,
    EOnboardingPagesV2.ShowRecoveryPhrase,
    EOnboardingPagesV2.VerifyRecoveryPhrase,
    'UnknownPage',
  ])('rejects non-opted-in onboarding page %s', (page) => {
    const path = `/onboarding/${page}`;
    expect(getWebStateFromPath(path, { screens })).toBeUndefined();
    expect(parseExtensionHash(`#${path}`)).toBeUndefined();
  });

  it.each([
    [
      '/reward-center',
      [
        ERootRoutes.Modal,
        EModalRoutes.MainModal,
        EModalRewardCenterRoutes.RewardCenter,
      ],
    ],
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
      '/defi/staking/ETH/lido',
      [
        ERootRoutes.Modal,
        EModalRoutes.StakingModal,
        EModalStakingRoutes.ProtocolDetails,
      ],
    ],
    [
      '/defi/staking/v2/ETH/lido',
      [
        ERootRoutes.Modal,
        EModalRoutes.StakingModal,
        EModalStakingRoutes.ProtocolDetailsV2,
      ],
    ],
    [
      '/defi/ethereum/ETH/lido',
      [
        ERootRoutes.Modal,
        EModalRoutes.StakingModal,
        EModalStakingRoutes.ProtocolDetailsV2Share,
      ],
    ],
    [
      '/ManagePosition?accountId=legacy-account',
      [
        ERootRoutes.Modal,
        EModalRoutes.StakingModal,
        EModalStakingRoutes.ManagePosition,
      ],
    ],
    [
      '/modal/SignatureConfirmModal/TxConfirmFromDApp?query=transaction',
      [
        ERootRoutes.Modal,
        EModalRoutes.SignatureConfirmModal,
        EModalSignatureConfirmRoutes.TxConfirmFromDApp,
      ],
    ],
    [
      '/modal/SignatureConfirmModal/MessageConfirmFromDApp?query=message',
      [
        ERootRoutes.Modal,
        EModalRoutes.SignatureConfirmModal,
        EModalSignatureConfirmRoutes.MessageConfirmFromDApp,
      ],
    ],
    [
      '/modal/ReferFriendsModal/ReferAFriend',
      [
        ERootRoutes.Modal,
        EModalRoutes.ReferFriendsModal,
        EModalReferFriendsRoutes.ReferAFriend,
      ],
    ],
  ])('parses cold-start path %s across root domains', (path, names) => {
    expect(
      getFocusedRouteNames(getWebStateFromPath(path, { screens })),
    ).toEqual(names);
  });

  it.each([
    '/modal/ApprovalManagementModal/BulkRevoke',
    '/fullScreenPush/ActionCenter/ActionCenter',
    '/RootWebView/WebView/WebView',
  ])('rejects internal runtime path %s', (path) => {
    expect(getWebStateFromPath(path, { screens })).toBeUndefined();
    expect(parseExtensionHash(`#${path}`)).toBeUndefined();
  });

  it.each(['/modal/DAppConnectionModal/ConnectionModal'])(
    'keeps Extension approval path %s private from Web',
    (path) => {
      expect(getWebStateFromPath(path, { screens })).toBeUndefined();
    },
  );

  it.each([
    [
      '#/modal/DAppConnectionModal/ConnectionModal?query=approval',
      [
        ERootRoutes.Modal,
        EModalRoutes.DAppConnectionModal,
        EDAppConnectionModal.ConnectionModal,
      ],
    ],
    [
      '#/iOSFullScreen/DAppConnectionModal/WalletConnectSessionProposalModal?query=proposal',
      [
        ERootRoutes.iOSFullScreen,
        EModalRoutes.DAppConnectionModal,
        EDAppConnectionModal.WalletConnectSessionProposalModal,
      ],
    ],
    [
      '#/modal/SignatureConfirmModal/MessageConfirmFromDApp?query=message',
      [
        ERootRoutes.Modal,
        EModalRoutes.SignatureConfirmModal,
        EModalSignatureConfirmRoutes.MessageConfirmFromDApp,
      ],
    ],
    [
      '#/iOSFullScreen/SignatureConfirmModal/TxConfirmFromDApp?query=transaction',
      [
        ERootRoutes.iOSFullScreen,
        EModalRoutes.SignatureConfirmModal,
        EModalSignatureConfirmRoutes.TxConfirmFromDApp,
      ],
    ],
  ])('parses Extension standalone approval hash %s', (hash, names) => {
    expect(getFocusedRouteNames(parseExtensionHash(hash))).toEqual(names);
  });

  it('preserves the v6.4.0 Extension permission display URL', () => {
    expect(
      getFocusedRouteNames(
        parseExtensionHash('#/permission/web-device?requestId=legacy'),
      ),
    ).toEqual([ERootRoutes.PermissionWebDevice]);
  });

  it('preserves the v6.4.0 development-only displayed modal URL', () => {
    if (!platformEnv.isDev) {
      return;
    }
    expect(
      getFocusedRouteNames(
        getWebStateFromPath('/modal/TestModal/TestSimpleModal', { screens }),
      ),
    ).toEqual([
      ERootRoutes.Modal,
      EModalRoutes.TestModal,
      ETestModalPages.TestSimpleModal,
    ]);
  });

  it('keeps allowed deep routes and excludes internal runtime routes', () => {
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
        EModalRoutes.ApprovalManagementModal,
        'BulkRevoke',
      ),
    ).toBeUndefined();
  });
});
