/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  ERootRoutes,
  ETabRoutes,
  PRIME_REDEEM_LANDING_PATH,
} from '@onekeyhq/shared/src/routes';

import {
  shouldHideDesktopWebFooter,
  useDesktopWebFooterRoute,
} from './desktopWebFooterRoute';

let routerChangeCallback:
  | ((state?: {
      routes?: {
        name?: string;
        state?: {
          index?: number;
          routeNames?: string[];
          routes?: { name?: string }[];
        };
      }[];
    }) => void)
  | undefined;

jest.mock('@onekeyhq/components', () => ({
  useOnRouterChange: (
    callback: (state?: {
      routes?: {
        name?: string;
        state?: {
          index?: number;
          routeNames?: string[];
          routes?: { name?: string }[];
        };
      }[];
    }) => void,
  ) => {
    routerChangeCallback = callback;
  },
}));

const homeRouterState = {
  routes: [
    {
      name: ERootRoutes.Main,
      state: {
        index: 0,
        routeNames: [ETabRoutes.Home],
        routes: [{ name: ETabRoutes.Home }],
      },
    },
  ],
};

describe('shouldHideDesktopWebFooter', () => {
  it('hides the Prime redeem landing while Home remains the selected tab', () => {
    expect(
      shouldHideDesktopWebFooter({
        currentTab: ETabRoutes.Home,
        pathname: PRIME_REDEEM_LANDING_PATH,
      }),
    ).toBe(true);
    expect(
      shouldHideDesktopWebFooter({
        currentTab: ETabRoutes.Home,
        pathname: `${PRIME_REDEEM_LANDING_PATH}/`,
      }),
    ).toBe(true);
  });

  it('keeps the footer on Home when the path is not the Prime redeem landing', () => {
    expect(
      shouldHideDesktopWebFooter({
        currentTab: ETabRoutes.Home,
        pathname: '/',
      }),
    ).toBe(false);
  });
});

describe('useDesktopWebFooterRoute', () => {
  const originalLocation = globalThis.location;

  afterEach(() => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('updates pathname when nested Home navigation does not change the tab', () => {
    const location = { pathname: '/' };
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: location,
    });

    const { result } = renderHook(() => useDesktopWebFooterRoute());

    expect(result.current.pathname).toBe('/');
    expect(result.current.hidden).toBe(false);

    location.pathname = PRIME_REDEEM_LANDING_PATH;
    act(() => {
      routerChangeCallback?.(homeRouterState);
    });

    expect(result.current.currentTab).toBe(ETabRoutes.Home);
    expect(result.current.pathname).toBe(PRIME_REDEEM_LANDING_PATH);
    expect(result.current.hidden).toBe(true);
  });
});
