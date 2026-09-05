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
  let rejectPendingRequest: (reason?: unknown) => void;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    request = jest.fn(
      () =>
        new Promise((_resolve, reject) => {
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

  it.each([false, true])(
    'opens the native app from the fallback button while an extension request is still pending (rejectAfterClick=%s)',
    async (rejectAfterClick) => {
      render(<PrimeSubscriptionLandingPage />);

      await act(async () => {
        jest.advanceTimersByTime(300);
        await Promise.resolve();
      });
      expect(request).toHaveBeenCalledTimes(1);
      expect(mockOpenAppViaDeepLink).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
      });
      fireEvent.click(
        screen.getByTestId(HomeTestIDs.primeSubscriptionOpenAppFallbackBtn),
      );

      if (rejectAfterClick) {
        await act(async () => {
          rejectPendingRequest(new Error('unsupported method'));
          await Promise.resolve();
        });
      }

      expect(request).toHaveBeenCalledTimes(1);
      expect(mockOpenAppViaDeepLink).toHaveBeenCalledTimes(1);
      expect(mockOpenAppViaDeepLink).toHaveBeenCalledWith(
        uriUtils.buildDeepLinkUrl({
          path: EOneKeyDeepLinkPath.prime_subscription,
        }),
      );
    },
  );

  it('does not launch from a pending extension request after unmount', async () => {
    const { unmount } = render(<PrimeSubscriptionLandingPage />);

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(1);
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
