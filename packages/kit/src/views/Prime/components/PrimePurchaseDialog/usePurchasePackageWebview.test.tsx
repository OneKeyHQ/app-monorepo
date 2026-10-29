/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';

import { usePurchasePackageWebview } from './usePurchasePackageWebview';

const mockPopStack = jest.fn();
const mockOpenWebview = jest.fn<void, [unknown]>();
const mockGetPendingSession = jest.fn(async () => ({ checkoutId: 'previous' }));
const mockClearPendingSession = jest.fn<Promise<boolean>, [unknown]>();
const mockGetApiKey = jest.fn(async () => ({
  apiKey: 'current-web-key',
  isSandboxKey: false,
}));
const mockNavigation = { popStack: mockPopStack };

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    user: { onekeyUserId: 'user-1' },
    supabaseUser: { email: 'user@example.com' },
  }),
}));
jest.mock('react-intl', () => ({ useIntl: () => ({ locale: 'en-US' }) }));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: {
    openUrlByWebviewPro: (params: unknown) => mockOpenWebview(params),
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      getLocalUserInfo: async () => ({
        isLoggedIn: true,
        onekeyUserId: 'user-1',
      }),
    },
    simpleDb: {
      prime: {
        getWebCheckoutPendingSession: () => mockGetPendingSession(),
        clearWebCheckoutPendingSession: (params: unknown) =>
          mockClearPendingSession(params),
      },
    },
  },
}));
jest.mock('../../hooks/getPrimePaymentApiKey', () => ({
  getPrimePaymentApiKey: () => mockGetApiKey(),
}));

describe('Android card payment entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearPendingSession.mockResolvedValue(true);
  });

  it('opens a fresh embedded payment with the current plan and environment on re-entry', async () => {
    const { result } = renderHook(() => usePurchasePackageWebview());
    await act(async () => {
      await result.current({
        selectedSubscriptionPeriod: 'P1Y',
        currency: 'USD',
      });
    });
    mockGetApiKey.mockResolvedValueOnce({
      apiKey: 'sandbox-web-key',
      isSandboxKey: true,
    });
    await act(async () => {
      await result.current({
        selectedSubscriptionPeriod: 'P1M',
        currency: 'EUR',
      });
    });

    expect(mockClearPendingSession).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      expectedCheckoutId: 'previous',
    });
    expect(mockClearPendingSession.mock.invocationCallOrder[0]).toBeLessThan(
      mockOpenWebview.mock.invocationCallOrder[0],
    );
    expect(mockPopStack).toHaveBeenCalledTimes(2);
    expect(mockOpenWebview).toHaveBeenCalledTimes(2);
    expect(mockOpenWebview).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        hashRoutePath: EWebEmbedRoutePath.primePurchase,
        hashRouteQueryParams: expect.objectContaining({
          primeUserId: 'user-1',
          subscriptionPeriod: 'P1M',
          currency: 'EUR',
          apiKey: 'sandbox-web-key',
          isSandboxKey: '1',
        }),
      }),
    );
  });

  it('keeps a racing replacement and does not open the Android embedded page', async () => {
    mockClearPendingSession.mockResolvedValueOnce(false);
    const { result } = renderHook(() => usePurchasePackageWebview());
    await expect(
      result.current({ selectedSubscriptionPeriod: 'P1M' }),
    ).rejects.toThrow('session changed');
    expect(mockPopStack).not.toHaveBeenCalled();
    expect(mockOpenWebview).not.toHaveBeenCalled();
  });

  it('does not open a payment without a selected plan', async () => {
    const { result } = renderHook(() => usePurchasePackageWebview());
    await act(async () => {
      await result.current({ selectedSubscriptionPeriod: undefined });
    });
    expect(mockPopStack).not.toHaveBeenCalled();
    expect(mockGetApiKey).not.toHaveBeenCalled();
    expect(mockOpenWebview).not.toHaveBeenCalled();
  });
});
