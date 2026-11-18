import { CommonActions, StackRouter } from '@react-navigation/routers';
import { Platform } from 'react-native';

import { rootNavigationRef } from '@onekeyhq/components';
import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { urlAccountNavigation } from './urlAccountUtils';

jest.mock('@react-navigation/native', () =>
  jest.requireActual<typeof import('@react-navigation/routers')>(
    '@react-navigation/routers',
  ),
);

jest.mock('@onekeyhq/components', () => ({
  navigateFromOverlayToTab: jest.fn(),
  resetAboveMainRoute: jest.fn(),
  rootNavigationRef: {},
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceNetwork: { getNetworkSafe: jest.fn() } },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      router: {
        switchTab: jest.fn(),
        switchTabDone: jest.fn(),
        pushRoute: jest.fn(),
      },
    },
  },
}));

const router = StackRouter({ initialRouteName: ETabHomeRoutes.TabHome });
const routerOptions = {
  routeNames: [ETabHomeRoutes.TabHome, ETabHomeRoutes.TabHomeUrlAccountPage],
  routeParamList: {},
  routeGetIdList: {},
};
let homeState = router.getInitialState(routerOptions);
const dispatch = (action: Parameters<typeof router.getStateForAction>[1]) => {
  const nextState = router.getStateForAction(homeState, action, routerOptions);
  if (nextState) {
    homeState = router.getRehydratedState(nextState, routerOptions);
  }
};
const navigation = { switchTab: jest.fn() } as unknown as IAppNavigation;
const openAddress = (address: string) =>
  urlAccountNavigation.pushOrReplaceUrlAccountPage(navigation, {
    address,
    networkId: 'evm--1',
  });

beforeEach(() => {
  homeState = router.getInitialState(routerOptions);
  Object.assign(rootNavigationRef, {
    current: {
      dispatch,
      getRootState: () => ({
        routes: [
          {
            name: ERootRoutes.Main,
            state: {
              index: 0,
              routes: [{ name: ETabRoutes.Home, state: homeState }],
            },
          },
        ],
      }),
    },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it.each(['ios', 'android'] as const)(
  'keeps Home below the %s address page so Back returns to the same Home',
  async (platform) => {
    jest
      .spyOn(Platform, 'select')
      .mockImplementation((options) => options[platform]);
    const [home] = homeState.routes;

    await openAddress('0xabc');
    expect(homeState.routes.map(({ name }) => name)).toEqual([
      ETabHomeRoutes.TabHome,
      ETabHomeRoutes.TabHomeUrlAccountPage,
    ]);

    await openAddress('0xdef');
    expect(homeState.routes).toHaveLength(2);
    expect(homeState.routes[1]?.params).toMatchObject({ address: '0xdef' });

    dispatch(CommonActions.goBack());
    expect(homeState.routes).toEqual([home]);
    expect(homeState.index).toBe(0);
  },
);

it('replaces Home when opening an address on other platforms', async () => {
  await openAddress('0xabc');

  expect(homeState.routes.map(({ name }) => name)).toEqual([
    ETabHomeRoutes.TabHomeUrlAccountPage,
  ]);
});
