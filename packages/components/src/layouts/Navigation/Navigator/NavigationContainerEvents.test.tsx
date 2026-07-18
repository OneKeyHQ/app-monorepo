/** @jest-environment jsdom */

import type { MutableRefObject, PropsWithChildren } from 'react';
import { StrictMode } from 'react';

import { act, renderHook } from '@testing-library/react';

import { useSplitMainView } from '../../../hooks/useSplitView';

import {
  RouterEventProvider,
  createRouterEventStore,
  rootNavigationRef,
  tabletMainViewNavigationRef,
  useOnRouterChange,
  useRouterContainerEventHandlers,
} from './NavigationContainerEvents';

import type {
  NavigationContainerRef,
  NavigationState,
  ParamListBase,
} from '@react-navigation/native';

jest.mock('../../../hooks/useSplitView', () => ({
  useSplitMainView: jest.fn(),
}));

const mockedUseSplitMainView = jest.mocked(useSplitMainView);

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

function createWrapper({
  store = createRouterEventStore(),
  strict = false,
}: {
  store?: ReturnType<typeof createRouterEventStore>;
  strict?: boolean;
}) {
  return function Wrapper({ children }: PropsWithChildren) {
    const content = (
      <RouterEventProvider value={store}>{children}</RouterEventProvider>
    );
    return strict ? <StrictMode>{content}</StrictMode> : content;
  };
}

describe('NavigationContainerEvents', () => {
  beforeEach(() => {
    mockedUseSplitMainView.mockReturnValue(false);
  });

  it('performs one ready handshake, publishes state changes, and cleans up the live listener', () => {
    const homeState = createNavigationState('Home');
    const nonHomeState = createNavigationState('Swap');
    const store = createRouterEventStore();
    const wrapper = createWrapper({ store });
    setNavigationRef(rootNavigationRef, homeState);
    const listener = jest.fn();
    const subscription = renderHook(() => useOnRouterChange(listener), {
      wrapper,
    });
    const handlers = renderHook(() => useRouterContainerEventHandlers(), {
      wrapper,
    }).result.current;

    expect(store.listeners.size).toBe(1);
    expect(listener).not.toHaveBeenCalled();

    act(() => handlers.onReady());
    expect(store).toEqual(
      expect.objectContaining({ isReady: true, currentState: homeState }),
    );
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(homeState);

    act(() => handlers.onReady());
    expect(listener).toHaveBeenCalledTimes(1);

    act(() => handlers.onStateChange(nonHomeState));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(nonHomeState);

    subscription.unmount();
    expect(store.listeners.size).toBe(0);
    act(() => handlers.onStateChange(homeState));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('replays only the ready store state to a late subscriber and keeps one StrictMode listener', () => {
    const homeState = createNavigationState('Home');
    const store = createRouterEventStore();
    const wrapper = createWrapper({ store, strict: true });
    setNavigationRef(rootNavigationRef, homeState);
    const handlers = renderHook(() => useRouterContainerEventHandlers(), {
      wrapper,
    }).result.current;

    act(() => handlers.onReady());
    expect(store.listeners.size).toBe(0);

    const listener = jest.fn();
    const subscription = renderHook(() => useOnRouterChange(listener), {
      wrapper,
    });
    expect(store.listeners.size).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(homeState);

    subscription.unmount();
    expect(store.listeners.size).toBe(0);
  });

  it('uses the tablet MAIN ref and the root detail/SUB ref independently', () => {
    const mainState = createNavigationState('MainPane');
    const detailState = createNavigationState('DetailPane');
    const getMainRootState = setNavigationRef(
      tabletMainViewNavigationRef,
      mainState,
    );
    const getDetailRootState = setNavigationRef(rootNavigationRef, detailState);

    mockedUseSplitMainView.mockReturnValue(true);
    const mainStore = createRouterEventStore();
    const mainHandlers = renderHook(() => useRouterContainerEventHandlers(), {
      wrapper: createWrapper({ store: mainStore }),
    }).result.current;
    act(() => mainHandlers.onReady());
    expect(mainStore.currentState).toBe(mainState);
    expect(getMainRootState).toHaveBeenCalledTimes(1);
    expect(getDetailRootState).not.toHaveBeenCalled();

    mockedUseSplitMainView.mockReturnValue(false);
    const detailStore = createRouterEventStore();
    const detailHandlers = renderHook(() => useRouterContainerEventHandlers(), {
      wrapper: createWrapper({ store: detailStore }),
    }).result.current;
    act(() => detailHandlers.onReady());
    expect(detailStore.currentState).toBe(detailState);
    expect(getDetailRootState).toHaveBeenCalledTimes(1);
  });
});
