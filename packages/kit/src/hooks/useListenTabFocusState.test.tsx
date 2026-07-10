/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react-native';

import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

import useListenTabFocusState from './useListenTabFocusState';

import type { NavigationState } from '@react-navigation/native';

let mockRouterChangeListener:
  | ((state: NavigationState | undefined) => void)
  | undefined;

jest.mock('@onekeyhq/components', () => ({
  useOnRouterChange: (
    callback: (state: NavigationState | undefined) => void,
  ) => {
    mockRouterChangeListener = callback;
  },
}));

function buildState(
  currentTab: ETabRoutes,
  { withModal = false }: { withModal?: boolean } = {},
) {
  const tabRoutes = [
    { key: 'home', name: ETabRoutes.Home },
    { key: 'market', name: ETabRoutes.Market },
    { key: 'swap', name: ETabRoutes.Swap },
  ];
  const routes: any[] = [
    {
      key: 'main',
      name: ERootRoutes.Main,
      state: {
        index: tabRoutes.findIndex((route) => route.name === currentTab),
        routeNames: tabRoutes.map((route) => route.name),
        routes: tabRoutes,
      },
    },
  ];
  if (withModal) {
    routes.push({ key: 'modal', name: ERootRoutes.Modal });
  }
  return { index: routes.length - 1, routes } as NavigationState;
}

describe('useListenTabFocusState', () => {
  beforeEach(() => {
    mockRouterChangeListener = undefined;
  });

  it('only notifies when focus or modal visibility changes', () => {
    const callback = jest.fn();
    renderHook(() => useListenTabFocusState(ETabRoutes.Home, callback));

    act(() => mockRouterChangeListener?.(buildState(ETabRoutes.Home)));
    expect(callback).toHaveBeenLastCalledWith(true, false);

    act(() => mockRouterChangeListener?.(buildState(ETabRoutes.Home)));
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => mockRouterChangeListener?.(buildState(ETabRoutes.Market)));
    expect(callback).toHaveBeenLastCalledWith(false, false);

    act(() => mockRouterChangeListener?.(buildState(ETabRoutes.Market)));
    expect(callback).toHaveBeenCalledTimes(2);

    act(() =>
      mockRouterChangeListener?.(
        buildState(ETabRoutes.Market, { withModal: true }),
      ),
    );
    expect(callback).toHaveBeenLastCalledWith(false, true);

    act(() => mockRouterChangeListener?.(buildState(ETabRoutes.Market)));
    expect(callback).toHaveBeenLastCalledWith(false, false);
    expect(callback).toHaveBeenCalledTimes(4);
  });

  it('preserves the extension fallback state', () => {
    const callback = jest.fn();
    renderHook(() => useListenTabFocusState(ETabRoutes.Home, callback));

    act(() => mockRouterChangeListener?.(undefined));
    act(() => mockRouterChangeListener?.(undefined));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(true, false);
  });
});
