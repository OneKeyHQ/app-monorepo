/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import enCatalog from '@onekeyhq/shared/src/locale/json/en_US.json';
import {
  ERootRoutes,
  ETabHomeRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import {
  WEB_ROUTE_RECOVERED_EVENT,
  clearWebRouteNotFoundState,
  syncWebRouteNotFoundState,
} from '../../routes/config/webDappUrlFallback';

import NotFound from './index.web-only';

const mockNavigate = jest.fn();
let mockIsWebDappMode = false;
const enMessages: Record<string, string> = enCatalog;

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
  SizableText: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  YStack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isWebDappMode() {
      return mockIsWebDappMode;
    },
  },
}));
jest.mock('../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ navigate: mockNavigate }),
}));

afterEach(() => {
  mockNavigate.mockClear();
  jest.restoreAllMocks();
  clearWebRouteNotFoundState();
  globalThis.history.replaceState(null, '', '/');
});

it.each([
  [true, ETabRoutes.Market, ETabMarketRoutes.TabMarket],
  [false, ETabRoutes.Home, ETabHomeRoutes.TabHome],
])(
  'opens the app landing screen on demand (Web DApp mode %s)',
  (isDapp, tab, page) => {
    mockIsWebDappMode = isDapp;
    const unmatchedPath = '/unmatched?utm_source=email';
    globalThis.history.replaceState(null, '', unmatchedPath);
    syncWebRouteNotFoundState({
      path: unmatchedPath,
      state: { routes: [{ name: ERootRoutes.NotFound }] },
    });
    const dispatch = jest.spyOn(globalThis, 'dispatchEvent');
    const recoveryEvent = expect.objectContaining({
      type: WEB_ROUTE_RECOVERED_EVENT,
    });
    render(
      <IntlProvider locale="en-US" messages={enMessages}>
        <NotFound />
      </IntlProvider>,
    );

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalledWith(recoveryEvent);
    expect(globalThis.location.pathname + globalThis.location.search).toBe(
      unmatchedPath,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(dispatch).toHaveBeenCalledWith(recoveryEvent);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: tab,
      params: { screen: page },
    });
  },
);
