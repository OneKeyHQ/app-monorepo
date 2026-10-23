/** @jest-environment jsdom */
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

import {
  resetAboveMainRoute,
  rootNavigationRef,
  switchTab,
  tabletMainViewNavigationRef,
} from './NavigationContainer';

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: (state: unknown) => ({ type: 'RESET', payload: state }),
  },
  StackActions: {},
  DefaultTheme: {},
  DarkTheme: {},
  NavigationContainer: () => null,
}));
jest.mock('@onekeyhq/components/src/hooks/useSplitView', () => ({
  useSplitMainView: jest.fn(),
}));
jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  useTheme: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { router: { switchTab: jest.fn(), switchTabDone: jest.fn() } },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('../../../hocs/Provider/hooks/useAppearanceTheme', () => ({
  updateAppRootViewBackground: jest.fn(),
}));
jest.mock('../../../hocs/Provider/hooks/useProviderValue', () => ({
  useSettingConfig: jest.fn(),
}));

const mockRootNavigate = jest.fn();
const mockTabletNavigate = jest.fn();
const getRootState = () => ({
  index: 0,
  routes: [
    {
      name: ERootRoutes.Main,
      state: { index: 0, routes: [{ name: ETabRoutes.WebviewPerpTrade }] },
    },
  ],
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  Object.assign(rootNavigationRef, {
    current: { getRootState, navigate: mockRootNavigate },
  });
  Object.assign(tabletMainViewNavigationRef, {
    current: { getRootState, navigate: mockTabletNavigate },
  });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('forwards entry params to root and tablet even when the tab is already selected', () => {
  const params = {
    screen: ETabRoutes.WebviewPerpTrade,
    params: { tradeRequest: { requestId: 'own-ui', expiresAt: 2000 } },
  } as const;
  switchTab(ETabRoutes.WebviewPerpTrade, params);
  jest.runAllTimers();
  for (const navigate of [mockRootNavigate, mockTabletNavigate]) {
    expect(navigate).toHaveBeenCalledWith(
      ERootRoutes.Main,
      { screen: ETabRoutes.WebviewPerpTrade, params },
      { pop: true },
    );
  }
});

it('preserves the selected tab without navigation when no new params are supplied', () => {
  switchTab(ETabRoutes.WebviewPerpTrade);
  jest.runAllTimers();
  expect(mockRootNavigate).not.toHaveBeenCalled();
  expect(mockTabletNavigate).not.toHaveBeenCalled();
});

it('dismisses both deposit and history overlays while preserving the trading tab', () => {
  const mainRoute = getRootState().routes[0];
  const dispatch = jest.fn();
  Object.assign(rootNavigationRef, {
    current: {
      getRootState: () => ({
        index: 2,
        routes: [
          mainRoute,
          { key: 'deposit', name: ERootRoutes.Modal },
          { key: 'history', name: ERootRoutes.Modal },
        ],
      }),
      dispatch,
    },
  });

  resetAboveMainRoute();

  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(dispatch).toHaveBeenCalledWith({
    type: 'RESET',
    payload: { index: 0, routes: [mainRoute] },
  });
});

it('leaves the trading route alone when there are no overlays', () => {
  const dispatch = jest.fn();
  Object.assign(rootNavigationRef, { current: { getRootState, dispatch } });

  resetAboveMainRoute();

  expect(dispatch).not.toHaveBeenCalled();
});
