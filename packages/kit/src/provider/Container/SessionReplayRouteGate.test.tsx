/** @jest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';

import {
  acquireReplayPause,
  notifyReplayActivity,
  setReplayCondition,
  setReplayRouteAllowed,
} from '@onekeyhq/shared/src/modules3rdParty/posthog/replayGate';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabDiscoveryRoutes,
  ETabHomeRoutes,
  ETabRoutes,
  ETabSwapRoutes,
} from '@onekeyhq/shared/src/routes';

import { SessionReplayRouteGate } from './SessionReplayRouteGate';

import type { IReplayNavState } from '../../components/SessionReplay/replayRouteClassifier';

type IAppStateListener = (state: string) => void;

const mockRouterCallbacks: ((state: IReplayNavState | undefined) => void)[] =
  [];
const mockAppStateListeners = new Set<IAppStateListener>();
const mockAppState = { currentState: 'active' };
const mockSettings = { selectedBrowserTab: 'global.browser' };
const mockSplitView = { value: false };
const mockTravelMode = { kind: 'standard' };
let mockInAppBrowserListener: (() => (() => void) | void) | undefined;
const mockReleasePause = jest.fn();

jest.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return mockAppState.currentState;
    },
    addEventListener: (_type: string, listener: IAppStateListener) => {
      mockAppStateListeners.add(listener);
      return { remove: () => mockAppStateListeners.delete(listener) };
    },
  },
}));

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: { current: null },
  useOnRouterChange: (
    callback: (state: IReplayNavState | undefined) => void,
  ) => {
    mockRouterCallbacks.push(callback);
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/settings', () => ({
  useSettingsPersistAtom: () => [mockSettings],
}));

jest.mock('../../hooks/useShouldUseSplitView', () => ({
  useShouldUseSplitView: () => mockSplitView.value,
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    global_earn: 'global.earn',
    global_browser: 'global.browser',
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeAndroid: false },
}));

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({
      profile: { kind: mockTravelMode.kind },
    }),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  setInAppBrowserLifecycleListener: (
    listener: (() => (() => void) | void) | undefined,
  ) => {
    mockInAppBrowserListener = listener;
    return () => {
      if (mockInAppBrowserListener === listener) {
        mockInAppBrowserListener = undefined;
      }
    };
  },
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/posthog/replayGate', () => ({
  acquireReplayPause: jest.fn(() => mockReleasePause),
  notifyReplayActivity: jest.fn(),
  setReplayCondition: jest.fn(),
  setReplayRouteAllowed: jest.fn(),
}));

const mockPlatformEnv = platformEnv as unknown as {
  isNative: boolean;
  isNativeAndroid: boolean;
};
const mockSetReplayRouteAllowed = setReplayRouteAllowed as jest.Mock;
const mockSetReplayCondition = setReplayCondition as jest.Mock;
const mockNotifyReplayActivity = notifyReplayActivity as jest.Mock;
const mockAcquireReplayPause = acquireReplayPause as jest.Mock;

const tabState = (tab: ETabRoutes, leaf: string): IReplayNavState => ({
  index: 0,
  routes: [
    {
      name: ERootRoutes.Main,
      state: {
        index: 0,
        routes: [{ name: tab, state: { index: 0, routes: [{ name: leaf }] } }],
      },
    },
  ],
});

const emitRoute = (state: IReplayNavState | undefined) => {
  act(() => {
    mockRouterCallbacks.forEach((callback) => callback(state));
  });
};

const emitAppState = (state: string) => {
  mockAppState.currentState = state;
  act(() => {
    mockAppStateListeners.forEach((listener) => listener(state));
  });
};

describe('SessionReplayRouteGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockRouterCallbacks.length = 0;
    mockAppStateListeners.clear();
    mockAppState.currentState = 'active';
    mockSettings.selectedBrowserTab = 'global.browser';
    mockSplitView.value = false;
    mockTravelMode.kind = 'standard';
    mockPlatformEnv.isNative = true;
    mockPlatformEnv.isNativeAndroid = false;
    mockInAppBrowserListener = undefined;
  });

  afterEach(() => {
    cleanup();
  });

  it('reports the classified route and touches the session', () => {
    render(<SessionReplayRouteGate />);
    mockSetReplayRouteAllowed.mockClear();
    mockNotifyReplayActivity.mockClear();

    emitRoute(tabState(ETabRoutes.Swap, ETabSwapRoutes.TabSwap));
    expect(mockSetReplayRouteAllowed).toHaveBeenLastCalledWith(
      true,
      'main/Swap/TabSwap',
    );
    expect(mockNotifyReplayActivity).toHaveBeenCalled();

    emitRoute(tabState(ETabRoutes.Home, ETabHomeRoutes.TabHome));
    expect(mockSetReplayRouteAllowed).toHaveBeenLastCalledWith(
      false,
      'main/Home/TabHome',
    );
  });

  it('re-evaluates the Discovery home when the Earn sub-tab is selected', () => {
    const { rerender } = render(<SessionReplayRouteGate />);
    emitRoute(tabState(ETabRoutes.Discovery, ETabDiscoveryRoutes.TabDiscovery));
    expect(mockSetReplayRouteAllowed).toHaveBeenLastCalledWith(
      false,
      'main/Discovery/TabDiscovery',
    );

    mockSettings.selectedBrowserTab = 'global.earn';
    rerender(<SessionReplayRouteGate />);
    expect(mockSetReplayRouteAllowed).toHaveBeenLastCalledWith(
      true,
      'main/Discovery/TabDiscovery',
    );
  });

  it('never treats the desktop Discovery home as Earn', () => {
    mockPlatformEnv.isNative = false;
    mockSettings.selectedBrowserTab = 'global.earn';
    render(<SessionReplayRouteGate />);
    emitRoute(tabState(ETabRoutes.Discovery, ETabDiscoveryRoutes.TabDiscovery));
    expect(mockSetReplayRouteAllowed).toHaveBeenLastCalledWith(
      false,
      'main/Discovery/TabDiscovery',
    );
  });

  it('maps app state, split view and travel mode to gate conditions', () => {
    mockSplitView.value = true;
    mockTravelMode.kind = 'travel-mode';
    render(<SessionReplayRouteGate />);
    expect(mockSetReplayCondition).toHaveBeenCalledWith('splitView', true);
    expect(mockSetReplayCondition).toHaveBeenCalledWith('travelMode', true);
    expect(mockSetReplayCondition).toHaveBeenCalledWith('background', false);

    emitAppState('background');
    expect(mockSetReplayCondition).toHaveBeenLastCalledWith('background', true);

    mockTravelMode.kind = 'standard';
    mockNotifyReplayActivity.mockClear();
    emitAppState('active');
    expect(mockSetReplayCondition).toHaveBeenCalledWith('background', false);
    expect(mockSetReplayCondition).toHaveBeenLastCalledWith(
      'travelMode',
      false,
    );
    expect(mockNotifyReplayActivity).toHaveBeenCalled();
  });

  it('pauses while the iOS in-app browser is presented', () => {
    render(<SessionReplayRouteGate />);
    expect(mockInAppBrowserListener).toBeDefined();

    const onSettled = mockInAppBrowserListener?.();
    expect(mockAcquireReplayPause).toHaveBeenCalledWith('inAppBrowser');
    expect(mockReleasePause).not.toHaveBeenCalled();
    onSettled?.();
    expect(mockReleasePause).toHaveBeenCalledTimes(1);
  });

  it('holds the Android Custom Tabs pause until the app is active again', () => {
    mockPlatformEnv.isNativeAndroid = true;
    render(<SessionReplayRouteGate />);

    const onSettled = mockInAppBrowserListener?.();
    // Custom Tabs resolve at launch, before the activity pauses.
    onSettled?.();
    expect(mockReleasePause).not.toHaveBeenCalled();
    emitAppState('background');
    expect(mockReleasePause).not.toHaveBeenCalled();
    emitAppState('active');
    expect(mockReleasePause).toHaveBeenCalledTimes(1);
    emitAppState('background');
    emitAppState('active');
    expect(mockReleasePause).toHaveBeenCalledTimes(1);
  });

  it('releases the Android pause if the app never left the foreground', () => {
    jest.useFakeTimers();
    mockPlatformEnv.isNativeAndroid = true;
    render(<SessionReplayRouteGate />);

    const onSettled = mockInAppBrowserListener?.();
    onSettled?.();
    expect(mockReleasePause).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockReleasePause).toHaveBeenCalledTimes(1);
  });

  it('denies the route and drops its listeners on unmount', () => {
    const { unmount } = render(<SessionReplayRouteGate />);
    emitRoute(tabState(ETabRoutes.Swap, ETabSwapRoutes.TabSwap));
    unmount();
    expect(mockSetReplayRouteAllowed).toHaveBeenLastCalledWith(false);
    expect(mockInAppBrowserListener).toBeUndefined();
    expect(mockAppStateListeners.size).toBe(0);
  });
});
