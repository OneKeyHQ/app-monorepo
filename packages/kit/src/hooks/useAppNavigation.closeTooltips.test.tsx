/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import {
  EModalRoutes,
  ERootRoutes,
  EScanQrCodeModalPages,
} from '@onekeyhq/shared/src/routes';

const callOrder: string[] = [];
const mockPush = jest.fn((...args: unknown[]) => {
  callOrder.push('push');
  return args;
});
const mockCloseAllTooltips = jest.fn(() => {
  callOrder.push('closeAllTooltips');
});
const mockGetState = jest.fn<unknown, []>();
const mockRootDispatch = jest.fn<void, unknown[]>();

jest.mock('@react-navigation/core', () => ({
  StackActions: {
    push: (name: string, params: unknown) => ({
      type: 'PUSH',
      payload: { name, params },
    }),
  },
  useNavigation: () => ({
    push: (...args: unknown[]) => mockPush(...args),
    getParent: () => undefined,
    getState: () => mockGetState(),
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
  rootNavigationRef: {
    current: {
      dispatch: (...args: unknown[]) => mockRootDispatch(...args),
      getState: () => mockGetState(),
      isReady: () => true,
    },
  },
  tabletMainViewNavigationRef: { current: null },
  popToMainRoute: jest.fn(),
  popToTabRootScreen: jest.fn(),
  resetAboveMainRoute: jest.fn(),
  switchTab: jest.fn(),
  switchTabAsync: jest.fn(),
}));

// eslint-disable-next-line import/first
import useAppNavigation from './useAppNavigation';

describe('useAppNavigation modal pushes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    callOrder.length = 0;
    mockPush.mockClear();
    mockRootDispatch.mockClear();
    mockCloseAllTooltips.mockClear();
    mockGetState.mockReturnValue({ index: 0, routes: [] });
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

  it.each(['route params', 'nested state'])(
    'opens the scoped scanner above its parent and deduplicates the same request in %s',
    (representation) => {
      const main = { name: ERootRoutes.Main };
      const parent = {
        name: ERootRoutes.Modal,
        params: {
          screen: EModalRoutes.ScanQrCodeModal,
          params: { screen: EScanQrCodeModalPages.ScanQrCodeStack },
        },
      };
      mockGetState.mockReturnValue({ index: 1, routes: [main, parent] });
      const { result } = renderHook(() => useAppNavigation());
      const callback = async () => ({});
      const scan = {
        screen: EScanQrCodeModalPages.ScanQrCodeStack,
        params: { callback, scanRequestId: 'air-gap:42' },
      };

      act(() => {
        result.current.pushModal(EModalRoutes.ScanQrCodeModal, scan);
      });
      expect(mockRootDispatch).toHaveBeenCalledWith({
        type: 'PUSH',
        payload: {
          name: ERootRoutes.Modal,
          params: { screen: EModalRoutes.ScanQrCodeModal, params: scan },
        },
      });
      expect(mockPush).not.toHaveBeenCalled();

      const child =
        representation === 'route params'
          ? {
              name: ERootRoutes.Modal,
              params: { ...parent.params, params: scan },
            }
          : {
              name: ERootRoutes.Modal,
              state: {
                index: 0,
                routes: [
                  {
                    name: EModalRoutes.ScanQrCodeModal,
                    state: {
                      index: 0,
                      routes: [{ name: scan.screen, params: scan.params }],
                    },
                  },
                ],
              },
            };
      mockGetState.mockReturnValue({ index: 2, routes: [main, parent, child] });
      act(() => {
        jest.advanceTimersByTime(1000);
        result.current.pushModal(EModalRoutes.ScanQrCodeModal, scan);
      });
      expect(mockRootDispatch).toHaveBeenCalledTimes(1);
    },
  );
});
