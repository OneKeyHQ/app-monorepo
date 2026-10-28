/** @jest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';

import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

import { getPrimePaymentApiKey } from '../../hooks/getPrimePaymentApiKey';
import { resumePendingPrimeHostedCardCheckout } from '../../hooks/primeHostedCardCheckout';

import { usePurchasePackageWebview } from './usePurchasePackageWebview';

const mockPopStack = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ locale: 'en-US' }),
}));

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    user: { onekeyUserId: 'user-1' },
    supabaseUser: { email: 'user@example.com' },
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ popStack: mockPopStack }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: false },
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: { openUrlByWebviewPro: jest.fn() },
}));

jest.mock('../../hooks/getPrimePaymentApiKey', () => ({
  getPrimePaymentApiKey: jest.fn(),
}));

jest.mock('../../hooks/primeHostedCardCheckout', () => ({
  resumePendingPrimeHostedCardCheckout: jest.fn(),
}));

describe('usePurchasePackageWebview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getPrimePaymentApiKey).mockResolvedValue({
      apiKey: 'test-api-key',
      isSandboxKey: false,
    });
    jest.mocked(resumePendingPrimeHostedCardCheckout).mockResolvedValue(false);
  });

  afterEach(cleanup);

  test('opens the embedded card checkout with its header menu hidden', async () => {
    const { result } = renderHook(usePurchasePackageWebview);

    await act(async () => {
      await result.current({
        selectedSubscriptionPeriod: 'P1Y',
        currency: 'USD',
      });
    });

    expect(mockPopStack).toHaveBeenCalledTimes(1);
    expect(openUrlUtils.openUrlByWebviewPro).toHaveBeenCalledTimes(1);
    expect(openUrlUtils.openUrlByWebviewPro).toHaveBeenCalledWith({
      url: '',
      title: 'WebView',
      isWebEmbed: true,
      hideHeaderRight: true,
      hashRoutePath: EWebEmbedRoutePath.primePurchase,
      hashRouteQueryParams: {
        primeUserId: 'user-1',
        primeUserEmail: 'user@example.com',
        subscriptionPeriod: 'P1Y',
        locale: 'en-US',
        mode: 'prod',
        apiKey: 'test-api-key',
        isSandboxKey: '0',
        currency: 'USD',
      },
    });
  });

  test('does not open a new WebView when a hosted checkout resumes', async () => {
    jest.mocked(resumePendingPrimeHostedCardCheckout).mockResolvedValue(true);
    const { result } = renderHook(usePurchasePackageWebview);

    await act(async () => {
      await result.current({ selectedSubscriptionPeriod: 'P1M' });
    });

    expect(resumePendingPrimeHostedCardCheckout).toHaveBeenCalledWith('user-1');
    expect(getPrimePaymentApiKey).not.toHaveBeenCalled();
    expect(openUrlUtils.openUrlByWebviewPro).not.toHaveBeenCalled();
  });
});
