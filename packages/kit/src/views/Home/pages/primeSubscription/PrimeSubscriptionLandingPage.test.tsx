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

import { PrimeSubscriptionLandingPage } from './PrimeSubscriptionLandingPage';

const mockOpenAppViaDeepLink = openAppViaDeepLink as jest.MockedFunction<
  typeof openAppViaDeepLink
>;

const PRIME_SUBSCRIPTION_DEEP_LINK = uriUtils.buildDeepLinkUrl({
  path: EOneKeyDeepLinkPath.prime_subscription,
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

describe('PrimeSubscriptionLandingPage fallback open-app button', () => {
  let request: jest.Mock;
  let resolvePendingRequest: (value?: unknown) => void;
  let rejectPendingRequest: (reason?: unknown) => void;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    request = jest.fn(
      () =>
        new Promise((resolve, reject) => {
          resolvePendingRequest = resolve;
          rejectPendingRequest = reject;
        }),
    );
    (
      globalThis as {
        $onekey?: {
          $private: {
            request: (args: { method: string }) => Promise<unknown>;
          };
        };
      }
    ).$onekey = { $private: { request } };
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    delete (globalThis as { $onekey?: unknown }).$onekey;
  });

  async function renderAndStartExtensionRequest() {
    const view = render(<PrimeSubscriptionLandingPage />);
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(mockOpenAppViaDeepLink).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId(HomeTestIDs.primeSubscriptionOpenAppFallbackBtn),
    ).toBeNull();
    return view;
  }

  it('does not show native fallback or launch when a slow extension request succeeds', async () => {
    await renderAndStartExtensionRequest();

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    expect(
      screen.queryByTestId(HomeTestIDs.primeSubscriptionOpenAppFallbackBtn),
    ).toBeNull();
    expect(mockOpenAppViaDeepLink).not.toHaveBeenCalled();

    await act(async () => {
      resolvePendingRequest(undefined);
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(
      screen.queryByTestId(HomeTestIDs.primeSubscriptionOpenAppFallbackBtn),
    ).toBeNull();
    expect(mockOpenAppViaDeepLink).not.toHaveBeenCalled();
  });

  it('launches native after a rejected extension request, then shows fallback', async () => {
    await renderAndStartExtensionRequest();

    await act(async () => {
      rejectPendingRequest(new Error('unsupported method'));
      await Promise.resolve();
    });
    expect(mockOpenAppViaDeepLink).toHaveBeenCalledTimes(1);
    expect(mockOpenAppViaDeepLink).toHaveBeenCalledWith(
      PRIME_SUBSCRIPTION_DEEP_LINK,
    );
    expect(
      screen.queryByTestId(HomeTestIDs.primeSubscriptionOpenAppFallbackBtn),
    ).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    fireEvent.click(
      screen.getByTestId(HomeTestIDs.primeSubscriptionOpenAppFallbackBtn),
    );
    expect(mockOpenAppViaDeepLink).toHaveBeenCalledTimes(2);
    expect(mockOpenAppViaDeepLink).toHaveBeenLastCalledWith(
      PRIME_SUBSCRIPTION_DEEP_LINK,
    );
  });

  it('does not launch from a pending extension request after unmount', async () => {
    const { unmount } = await renderAndStartExtensionRequest();
    unmount();
    // Drain React act microtasks before counting remaining timers.
    jest.runAllTicks();
    expect(jest.getTimerCount()).toBe(0);

    await act(async () => {
      rejectPendingRequest(new Error('unsupported method'));
      await Promise.resolve();
    });

    expect(mockOpenAppViaDeepLink).not.toHaveBeenCalled();
  });
});
