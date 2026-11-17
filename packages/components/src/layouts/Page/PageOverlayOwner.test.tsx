/** @jest-environment jsdom */
// Navigation fixtures model focused-route changes without a live navigator.
/* oxlint-disable react-perf/jsx-no-new-object-as-prop, react/jsx-no-constructed-context-values */

import type { ReactNode } from 'react';

import { OverlayPageHostScope } from '@onekeyfe/react-native-native-overlay';
import {
  NavigationContext,
  NavigationRouteContext,
} from '@react-navigation/native';
import { act, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  ImperativeOverlayMountHost,
  mountImperativeOverlay,
} from '../../shared/imperativeOverlayMount';

import { PageOverlayOwner } from './PageOverlayOwner';

import type { NavigationProp, ParamListBase } from '@react-navigation/native';

const mockSetPageVisible = jest.fn();
const mockRemovePage = jest.fn();
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  ...(() => {
    const React = jest.requireActual<typeof import('react')>('react');
    const Scope = React.createContext<{
      hostKey?: string;
      ownerKey?: string;
    }>({});
    return {
      useOverlayPageScope: () => React.useContext(Scope),
      OverlayPageHostScope: ({
        children,
        hostKey,
      }: {
        children?: ReactNode;
        hostKey: string;
      }) => <Scope.Provider value={{ hostKey }}>{children}</Scope.Provider>,
      OverlayPageOwnerScope: ({
        children,
        ownerKey,
      }: {
        children?: ReactNode;
        ownerKey: string;
      }) => {
        const { hostKey } = React.useContext(Scope);
        return (
          <Scope.Provider value={{ hostKey, ownerKey }}>
            {children}
          </Scope.Provider>
        );
      },
      overlayStore: {
        setPageVisible: (...args: unknown[]) => {
          mockSetPageVisible(...args);
        },
        removePage: (...args: unknown[]) => {
          mockRemovePage(...args);
        },
      },
    };
  })(),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    NavigationContext: React.createContext(undefined),
    NavigationRouteContext: React.createContext(undefined),
  };
});
type INavigation = NavigationProp<ParamListBase>;
function setup(covered: boolean) {
  const listeners = new Set<() => void>();
  const rootState = {
    key: 'root',
    index: covered ? 1 : 0,
    routes: [{ key: 'main', state: { key: 'tabs' } }, { key: 'modal' }],
  };
  const root = {
    getState: () => rootState,
    getParent: () => undefined,
    addListener: (_event: string, fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  const child = {
    getState: () => ({ key: 'tabs', index: 0, routes: [{ key: 'wallet' }] }),
    getParent: () => root,
    addListener: root.addListener,
  };
  render(
    <NavigationContext.Provider value={child as unknown as INavigation}>
      <NavigationRouteContext.Provider
        value={{ key: 'wallet', name: 'Wallet' }}
      >
        <PageOverlayOwner>
          <div>Wallet</div>
        </PageOverlayOwner>
      </NavigationRouteContext.Provider>
    </NavigationContext.Provider>,
  );
  return {
    rootState,
    update: () =>
      act(() => {
        listeners.forEach((fn) => fn());
      }),
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  platformEnv.isNative = false;
});
it.each([false, true])(
  'initializes owner visibility on an already mounted screen: covered=%s',
  (covered) => {
    setup(covered);
    expect(mockSetPageVisible).toHaveBeenCalledWith('wallet', !covered);
  },
);
it('suspends a web owner when a root modal opens and restores it on return', () => {
  const { rootState, update } = setup(false);
  rootState.index = 1;
  update();
  expect(mockSetPageVisible).toHaveBeenLastCalledWith('wallet', false);
  rootState.index = 0;
  update();
  expect(mockSetPageVisible).toHaveBeenLastCalledWith('wallet', true);
});
it('preserves native page-host visibility when covered by a root modal', () => {
  platformEnv.isNative = true;
  setup(true);
  expect(mockSetPageVisible).toHaveBeenCalledWith('wallet', true);
});

it('keeps the outer page owner live when a nested Page unmounts', () => {
  const navigation = {
    getState: () => ({ index: 0, routes: [{ key: 'wallet' }] }),
    getParent: () => undefined,
    addListener: () => () => undefined,
  } as unknown as INavigation;
  const page = (showNested: boolean) => (
    <OverlayPageHostScope hostKey="main">
      <NavigationContext.Provider value={navigation}>
        <NavigationRouteContext.Provider
          value={{ key: 'wallet', name: 'Wallet' }}
        >
          <PageOverlayOwner>
            {showNested ? (
              <PageOverlayOwner>
                <div>Nested page</div>
              </PageOverlayOwner>
            ) : null}
          </PageOverlayOwner>
        </NavigationRouteContext.Provider>
      </NavigationContext.Provider>
    </OverlayPageHostScope>
  );
  const pageView = render(page(false));
  expect(mockSetPageVisible).toHaveBeenCalledTimes(1);
  pageView.rerender(page(true));
  expect(mockSetPageVisible).toHaveBeenCalledTimes(1);
  pageView.rerender(page(false));
  expect(mockRemovePage).not.toHaveBeenCalled();

  const dialog = mountImperativeOverlay({
    target: 'page',
    page: { hostKey: 'main', ownerKey: 'wallet' },
    node: <div data-testid="outer-page-dialog" />,
  });
  const host = render(<ImperativeOverlayMountHost target="page" />);
  expect(screen.getByTestId('outer-page-dialog')).toBeTruthy();
  host.unmount();
  dialog.destroy();
  pageView.unmount();
  expect(mockRemovePage).toHaveBeenCalledTimes(1);
});

it('registers a new host owner independently of an inherited route key', () => {
  const navigation = {
    getState: () => ({ index: 0, routes: [{ key: 'wallet' }] }),
    getParent: () => undefined,
    addListener: () => () => undefined,
  } as unknown as INavigation;
  const page = (showNestedHost: boolean) => (
    <OverlayPageHostScope hostKey="main">
      <NavigationContext.Provider value={navigation}>
        <NavigationRouteContext.Provider
          value={{ key: 'wallet', name: 'Wallet' }}
        >
          <PageOverlayOwner>
            {showNestedHost ? (
              <OverlayPageHostScope hostKey="second">
                <PageOverlayOwner>
                  <div>Second host page</div>
                </PageOverlayOwner>
              </OverlayPageHostScope>
            ) : null}
          </PageOverlayOwner>
        </NavigationRouteContext.Provider>
      </NavigationContext.Provider>
    </OverlayPageHostScope>
  );
  const view = render(page(false));
  expect(mockSetPageVisible).toHaveBeenCalledTimes(1);
  view.rerender(page(true));
  expect(mockSetPageVisible).toHaveBeenCalledTimes(2);
  view.rerender(page(false));
  expect(mockRemovePage).toHaveBeenCalledWith('wallet');
  view.unmount();
});

it('keeps a nested route as a separate page owner', () => {
  const navigation = {
    getState: () => ({ index: 0, routes: [{ key: 'wallet' }] }),
    getParent: () => undefined,
    addListener: () => () => undefined,
  } as unknown as INavigation;
  const page = (showNestedRoute: boolean) => (
    <OverlayPageHostScope hostKey="main">
      <NavigationContext.Provider value={navigation}>
        <NavigationRouteContext.Provider
          value={{ key: 'wallet', name: 'Wallet' }}
        >
          <PageOverlayOwner>
            {showNestedRoute ? (
              <NavigationRouteContext.Provider
                value={{ key: 'details', name: 'Details' }}
              >
                <PageOverlayOwner>
                  <div>Details page</div>
                </PageOverlayOwner>
              </NavigationRouteContext.Provider>
            ) : null}
          </PageOverlayOwner>
        </NavigationRouteContext.Provider>
      </NavigationContext.Provider>
    </OverlayPageHostScope>
  );
  const view = render(page(false));
  view.rerender(page(true));
  expect(mockSetPageVisible).toHaveBeenCalledWith('details', false);
  view.rerender(page(false));
  expect(mockRemovePage).toHaveBeenCalledWith('details');
  view.unmount();
});
