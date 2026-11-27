/** @jest-environment jsdom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { HomeTestIDs } from '../../testIDs';
import { openAppViaDeepLink } from '../../utils/deepLinkLaunchUtils';

import { PrimeDashboardLandingPage } from './PrimeDashboardLandingPage';

const mockOpenAppViaDeepLink = openAppViaDeepLink as jest.MockedFunction<
  typeof openAppViaDeepLink
>;

const PRIME_DASHBOARD_DEEP_LINK = uriUtils.buildDeepLinkUrl({
  path: EOneKeyDeepLinkPath.prime_dashboard,
});

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('../../components/DeepLinkLanding', () => ({
  DeepLinkLanding: ({
    isFallbackVisible,
    onOpenApp,
    openAppTestID,
  }: {
    isFallbackVisible: boolean;
    onOpenApp: () => void;
    openAppTestID: string;
  }) =>
    isFallbackVisible ? (
      <button data-testid={openAppTestID} onClick={onOpenApp} type="button">
        Open app
      </button>
    ) : null,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true, isWebMobile: false },
}));

jest.mock('../../utils/deepLinkLaunchUtils', () => {
  const actual = jest.requireActual<
    typeof import('../../utils/deepLinkLaunchUtils')
  >('../../utils/deepLinkLaunchUtils');
  return {
    ...actual,
    openAppViaDeepLink: jest.fn(),
  };
});

describe('PrimeDashboardLandingPage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('launches the dashboard deep link, then offers an open-app fallback', async () => {
    render(<PrimeDashboardLandingPage />);
    expect(mockOpenAppViaDeepLink).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(mockOpenAppViaDeepLink).toHaveBeenCalledTimes(1);
    expect(mockOpenAppViaDeepLink).toHaveBeenCalledWith(
      PRIME_DASHBOARD_DEEP_LINK,
    );
    expect(
      screen.queryByTestId(HomeTestIDs.primeDashboardOpenAppFallbackBtn),
    ).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    fireEvent.click(
      screen.getByTestId(HomeTestIDs.primeDashboardOpenAppFallbackBtn),
    );
    expect(mockOpenAppViaDeepLink).toHaveBeenCalledTimes(2);
    expect(mockOpenAppViaDeepLink).toHaveBeenLastCalledWith(
      PRIME_DASHBOARD_DEEP_LINK,
    );
  });

  it('does not launch after unmount', () => {
    const { unmount } = render(<PrimeDashboardLandingPage />);
    unmount();
    jest.advanceTimersByTime(5000);
    expect(mockOpenAppViaDeepLink).not.toHaveBeenCalled();
  });

  it('opens the app even when the extension provider is present', async () => {
    const request = jest.fn();
    const host = globalThis as { $onekey?: unknown };
    host.$onekey = { $private: { request } };
    try {
      render(<PrimeDashboardLandingPage />);
      await act(async () => {
        jest.advanceTimersByTime(300);
        await Promise.resolve();
      });

      expect(request).not.toHaveBeenCalled();
      expect(mockOpenAppViaDeepLink).toHaveBeenCalledWith(
        PRIME_DASHBOARD_DEEP_LINK,
      );
    } finally {
      delete host.$onekey;
    }
  });
});
