/** @jest-environment jsdom */
// Navigation fixtures model focused-route changes without a live navigator.
/* oxlint-disable react-perf/jsx-no-new-object-as-prop, react/jsx-no-constructed-context-values */

import type { ReactNode } from 'react';

import {
  NavigationContext,
  NavigationRouteContext,
} from '@react-navigation/native';
import { act, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PageOverlayOwner } from './PageOverlayOwner';

import type { NavigationProp, ParamListBase } from '@react-navigation/native';

const mockSetPageVisible = jest.fn();
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useOverlayPageScope: () => ({}),
  OverlayPageHostScope: ({ children }: { children?: ReactNode }) => children,
  overlayStore: {
    setPageVisible: (...args: unknown[]) => {
      mockSetPageVisible(...args);
    },
    removePage: jest.fn(),
  },
  OverlayPageOwnerScope: ({ children }: { children?: ReactNode }) => children,
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
