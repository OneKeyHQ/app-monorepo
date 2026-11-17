/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { EModalRoutes } from '@onekeyhq/shared/src/routes';

const callOrder: string[] = [];
const mockPush = jest.fn((...args: unknown[]) => {
  callOrder.push('push');
  return args;
});
const mockCloseAllTooltips = jest.fn(() => {
  callOrder.push('closeAllTooltips');
});

jest.mock('@react-navigation/core', () => ({
  useNavigation: () => ({
    push: (...args: unknown[]) => mockPush(...args),
    getParent: () => undefined,
    getState: () => ({ index: 0, routes: [] }),
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  closeAllTooltips: () => mockCloseAllTooltips(),
  useSplitMainView: () => false,
  Page: {
    Header: {
      usePageHeaderReloadOptions: () => ({
        reload: (options: unknown) => options,
      }),
    },
  },
  rootNavigationRef: { current: null },
  tabletMainViewNavigationRef: { current: null },
  popToMainRoute: jest.fn(),
  popToTabRootScreen: jest.fn(),
  resetAboveMainRoute: jest.fn(),
  switchTab: jest.fn(),
  switchTabAsync: jest.fn(),
}));

// eslint-disable-next-line import/first
import useAppNavigation from './useAppNavigation';

describe('useAppNavigation closes open tooltips when a modal is pushed', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    callOrder.length = 0;
    mockPush.mockClear();
    mockCloseAllTooltips.mockClear();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('pushModal closes tooltips before pushing the modal route', () => {
    const { result } = renderHook(() => useAppNavigation());

    act(() => {
      result.current.pushModal(EModalRoutes.WalletAddress, {
        screen: 'WalletAddress' as never,
      });
    });

    expect(mockCloseAllTooltips).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['closeAllTooltips', 'push']);
  });

  it('pushFullModal closes tooltips before pushing the modal route', () => {
    const { result } = renderHook(() => useAppNavigation());

    act(() => {
      result.current.pushFullModal(EModalRoutes.WalletAddress, {
        screen: 'WalletAddress' as never,
      });
    });

    expect(mockCloseAllTooltips).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['closeAllTooltips', 'push']);
  });
});
