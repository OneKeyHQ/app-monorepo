import { StackRouter } from '@react-navigation/routers';

import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';

import { urlAccountNavigation } from './urlAccountUtils';

import type { NavigationAction } from '@react-navigation/routers';

jest.mock('@react-navigation/native', () =>
  jest.requireActual<typeof import('@react-navigation/routers')>(
    '@react-navigation/routers',
  ),
);
jest.mock(
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  () => ({}),
);
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({}));

let mockIsNative: boolean;
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  get isNative() {
    return mockIsNative;
  },
}));

const router = StackRouter({ initialRouteName: ETabHomeRoutes.TabHome });
const routerOptions = {
  routeNames: Object.values(ETabHomeRoutes),
  routeParamList: {},
  routeGetIdList: {},
};
const home = { name: ETabHomeRoutes.TabHome, key: 'home' };
const firstAddress = {
  name: ETabHomeRoutes.TabHomeUrlAccountPage,
  key: 'first-address',
};
const secondAddress = {
  name: ETabHomeRoutes.TabHomeUrlAccountPage,
  key: 'second-address',
};

function goBack(
  routes: ReturnType<typeof router.getInitialState>['routes'],
  isNative = true,
) {
  mockIsNative = isNative;
  const state = {
    ...router.getInitialState(routerOptions),
    index: routes.length - 1,
    routes,
  };

  let backAction: NavigationAction | undefined;
  const dispatch: IAppNavigation['dispatch'] = (actionOrUpdater) => {
    const action =
      typeof actionOrUpdater === 'function'
        ? actionOrUpdater(state)
        : actionOrUpdater;
    backAction = { source: routes[state.index]?.key, ...action };
  };

  urlAccountNavigation.goBack({ dispatch } as IAppNavigation);
  if (!backAction) {
    throw new OneKeyLocalError('Expected a URL Wallet back action');
  }
  return {
    action: backAction,
    state: router.getStateForAction(
      state,
      backAction as Parameters<typeof router.getStateForAction>[1],
      routerOptions,
    ),
  };
}

describe('URL Wallet back navigation', () => {
  it('returns directly to the existing Home after repeated address searches', () => {
    const { state } = goBack([home, firstAddress, secondAddress]);

    expect(state?.routes).toEqual([home]);
    expect(state?.routes[0]).toBe(home);
    expect(state?.index).toBe(0);
  });

  it('pops only to the nearest Home and keeps the in-progress Dust Sweep route', () => {
    const dustSweep = {
      name: ETabHomeRoutes.TabHomeDustSweep,
      key: 'dust-sweep',
    };
    const deepLinkHome = { ...home, key: 'deep-link-home' };

    const { state } = goBack([
      home,
      dustSweep,
      deepLinkHome,
      firstAddress,
      secondAddress,
    ]);

    expect(state?.routes).toEqual([home, dustSweep, deepLinkHome]);
    expect(state?.routes[1]).toBe(dustSweep);
    expect(state?.routes[2]).toBe(deepLinkHome);
    expect(state?.index).toBe(2);
  });

  it.each([
    { description: 'native entry', routes: [firstAddress] },
    {
      description: 'non-native address history',
      routes: [firstAddress, secondAddress],
      isNative: false,
    },
  ])('resets to Home with no existing Home on $description', (scenario) => {
    const { action, state } = goBack(scenario.routes, scenario.isNative);

    expect(action.type).toBe('RESET');
    expect(state?.routes).toEqual([{ name: ETabHomeRoutes.TabHome }]);
    expect(state?.index).toBe(0);
  });

  it('replaces a lone URL Wallet screen on non-native platforms', () => {
    const { action, state } = goBack([firstAddress], false);

    expect(action.type).toBe('REPLACE');
    expect(state?.routes).toMatchObject([{ name: ETabHomeRoutes.TabHome }]);
    expect(state?.index).toBe(0);
  });
});
