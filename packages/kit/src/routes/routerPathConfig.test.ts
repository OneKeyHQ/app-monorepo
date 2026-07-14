/** @jest-environment jsdom */

import {
  EOnboardingPagesV2,
  ERootRoutes,
  onboardingV2RouteConfig,
} from '@onekeyhq/shared/src/routes';
import type { IScreenPathConfig } from '@onekeyhq/shared/src/utils/routeUtils';

import { getStateFromPath as getWebStateFromPath } from './config/getStateFromPath';
import { getStateFromPath as getExtensionStateFromPath } from './config/getStateFromPath.ext';
import { resolveScreens } from './config/resolveScreens';
import { onboardingRouterV2PathConfig } from './routerPathConfig';

import type { NavigationState, PartialState } from '@react-navigation/routers';

type IPartialNavigationState = PartialState<NavigationState>;

const screens = resolveScreens([
  {
    name: ERootRoutes.Onboarding,
    children: onboardingRouterV2PathConfig,
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
