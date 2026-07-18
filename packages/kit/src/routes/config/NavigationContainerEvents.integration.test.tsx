/** @jest-environment jsdom */

import type { MutableRefObject, PropsWithChildren } from 'react';

import { useRouterConfig } from '.';

import { act, renderHook } from '@testing-library/react';

import {
  RouterEventProvider,
  createRouterEventStore,
  rootNavigationRef,
  tabletMainViewNavigationRef,
  useOnRouterChange,
} from '@onekeyhq/components';

import type {
  NavigationContainerRef,
  NavigationState,
  ParamListBase,
} from '@react-navigation/native';

const mockUseSplitMainView = jest.fn<boolean, []>();

jest.mock('@onekeyhq/components', () =>
  jest.requireActual<
    typeof import('../../../../components/src/layouts/Navigation/Navigator/NavigationContainerEvents')
  >(
    '../../../../components/src/layouts/Navigation/Navigator/NavigationContainerEvents',
  ),
);
jest.mock('@react-navigation/core', () => ({
  getPathFromState: jest.fn(() => '/'),
}));
jest.mock('@onekeyhq/shared/src/utils/routeUtils', () => ({
  buildAllowList: () => ({}),
}));
jest.mock('../../../../components/src/hooks/useSplitView', () => ({
  useSplitMainView: () => mockUseSplitMainView(),
}));
jest.mock('expo-linking', () => ({ createURL: () => 'onekey:///' }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('../../hooks/usePerpTabConfig', () => ({
  usePerpTabConfig: () => ({
    perpDisabled: false,
    perpTabShowWeb: false,
  }),
}));
jest.mock('../router', () => ({
  rootRouter: {},
  useRootRouter: () => [],
}));
jest.mock('./deeplink', () => ({ registerDeepLinking: jest.fn() }));

function createNavigationState(routeName: string): NavigationState {
  return {
    stale: false,
    type: 'stack',
    key: `${routeName}-state-key`,
    index: 0,
    routeNames: [routeName],
    routes: [{ key: `${routeName}-route-key`, name: routeName }],
  };
}

function setNavigationRef(
  ref: typeof rootNavigationRef,
  state: NavigationState,
) {
  const getRootState = jest.fn(() => state);
  const navigation = {
    getRootState,
  } as unknown as NavigationContainerRef<ParamListBase>;
  (
    ref as MutableRefObject<NavigationContainerRef<ParamListBase> | null>
  ).current = navigation;
  return getRootState;
}

function createWrapper(store: ReturnType<typeof createRouterEventStore>) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <RouterEventProvider value={store}>{children}</RouterEventProvider>;
  };
}

describe('useRouterConfig navigation event wiring', () => {
  beforeEach(() => {
    mockUseSplitMainView.mockReturnValue(false);
  });

  it('wires containerProps.onReady to the selected ref and replays it to a late subscriber', () => {
    const homeState = createNavigationState('Home');
    const store = createRouterEventStore();
    const wrapper = createWrapper(store);
    const getRootState = setNavigationRef(rootNavigationRef, homeState);
    const config = renderHook(() => useRouterConfig(), { wrapper }).result
      .current;

    act(() => config.containerProps.onReady?.());
    expect(getRootState).toHaveBeenCalledTimes(1);
    expect(store).toEqual(
      expect.objectContaining({ isReady: true, currentState: homeState }),
    );

    const listener = jest.fn();
    const subscription = renderHook(() => useOnRouterChange(listener), {
      wrapper,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(homeState);

    subscription.unmount();
    expect(store.listeners.size).toBe(0);
  });

  it('uses tablet MAIN and root detail/SUB refs for separate containerProps handshakes', () => {
    const mainState = createNavigationState('MainPane');
    const detailState = createNavigationState('DetailPane');
    const getMainRootState = setNavigationRef(
      tabletMainViewNavigationRef,
      mainState,
    );
    const getDetailRootState = setNavigationRef(rootNavigationRef, detailState);

    mockUseSplitMainView.mockReturnValue(true);
    const mainStore = createRouterEventStore();
    const mainConfig = renderHook(() => useRouterConfig(), {
      wrapper: createWrapper(mainStore),
    }).result.current;
    act(() => mainConfig.containerProps.onReady?.());
    expect(mainStore.currentState).toBe(mainState);
    expect(getMainRootState).toHaveBeenCalledTimes(1);
    expect(getDetailRootState).not.toHaveBeenCalled();

    mockUseSplitMainView.mockReturnValue(false);
    const detailStore = createRouterEventStore();
    const detailConfig = renderHook(() => useRouterConfig(), {
      wrapper: createWrapper(detailStore),
    }).result.current;
    act(() => detailConfig.containerProps.onReady?.());
    expect(detailStore.currentState).toBe(detailState);
    expect(getDetailRootState).toHaveBeenCalledTimes(1);
  });
});
