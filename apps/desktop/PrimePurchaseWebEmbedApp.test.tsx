/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import {
  EWebEmbedPrivateRequestMethod,
  PRIME_PURCHASE_CONSOLE_MESSAGE_PREFIX,
} from '@onekeyhq/shared/src/consts/webEmbedConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PrimePurchaseWebEmbedApp } from './PrimePurchaseWebEmbedApp';

const mockPurchasePackageWeb = jest.fn();
let mockQueryParams: Record<string, unknown> | undefined;
let mockFallbackTrigger: string | undefined;

jest.mock(
  '@onekeyhq/kit/src/views/Prime/hooks/usePrimePaymentMethods.web-embed',
  () => ({
    usePrimePaymentMethods: () => ({
      webEmbedQueryParams: mockQueryParams,
      purchasePackageWeb: mockPurchasePackageWeb,
    }),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Prime/purchasesSdk/primeEmbeddedCheckoutFallback',
  () => ({
    getPrimeEmbeddedCheckoutFallbackTrigger: () => mockFallbackTrigger,
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Prime/purchasesSdk/stripePaymentElementHealth',
  () => ({
    beginStripePaymentElementAttempt: jest.fn(),
    getStripePaymentElementState: () => 'loadError',
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Prime/purchasesSdk/purchasesSdkWebLoader',
  () => ({
    loadPurchasesSdkWeb: async () => ({
      Purchases: {
        getSharedInstance: () => ({}),
      },
    }),
  }),
);

jest.mock('@onekeyhq/kit/src/views/Prime/hooks/primePaymentUtils', () => ({
  __esModule: true,
  default: {
    fetchWebTargetOffering: async () => ({ targetOffering: {} }),
  },
}));

jest.mock('@onekeyhq/kit/src/views/Prime/hooks/primeWebPurchaseLink', () => ({
  getPrimeWebPurchaseLinkConfig: () => ({}),
  resolvePrimeWebPurchaseLinkPackage: () => ({
    identifier: '$rc_annual',
  }),
}));

jest.mock('@onekeyhq/shared/src/locale/localeLoaders', () => ({
  LOCALE_KEYS: ['en-US', 'zh-CN'],
  loadLocaleMessages: jest.fn(async () => ({})),
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    setLocale: jest.fn(),
    intl: {
      formatMessage: ({ id }: { id: string }) => `localized:${id}`,
    },
  },
}));

describe('PrimePurchaseWebEmbedApp', () => {
  const mockPrivateRequest = jest.fn(async () => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    mockFallbackTrigger = undefined;
    mockQueryParams = {
      apiKey: 'rc_key',
      primeUserId: 'user-1',
      primeUserEmail: 'user@example.com',
      subscriptionPeriod: 'P1Y',
      locale: 'zh-CN',
      currency: 'USD',
      isSandboxKey: false,
    };
    Object.defineProperty(globalThis, '$onekey', {
      configurable: true,
      writable: true,
      value: {
        $private: {
          request: mockPrivateRequest,
        },
      },
    });
  });

  it('closes immediately when required query params are missing', async () => {
    mockQueryParams = { apiKey: 'rc_key' };
    await act(async () => {
      render(<PrimePurchaseWebEmbedApp />);
    });
    expect(mockPrivateRequest).toHaveBeenCalledWith({
      method: EWebEmbedPrivateRequestMethod.closeWebViewModal,
    });
  });

  it('notifies host on active Prime entitlement after purchase', async () => {
    mockPurchasePackageWeb.mockResolvedValueOnce({
      customerInfo: {
        entitlements: {
          active: {
            Prime: { isActive: true },
          },
        },
      },
    });
    await act(async () => {
      render(<PrimePurchaseWebEmbedApp />);
    });
    expect(mockPrivateRequest).toHaveBeenCalledWith({
      method:
        EWebEmbedPrivateRequestMethod.closeWebViewModalAfterPrimePurchaseSuccess,
      params: { onekeyUserId: 'user-1' },
    });
  });

  it('shows a localized toast and closes when purchase fails without fallback', async () => {
    mockPurchasePackageWeb.mockRejectedValueOnce(new Error('card declined'));
    await act(async () => {
      render(<PrimePurchaseWebEmbedApp />);
    });
    expect(mockPrivateRequest).toHaveBeenCalledWith({
      method: EWebEmbedPrivateRequestMethod.showToast,
      params: {
        title: `localized:${ETranslations.global_an_error_occurred}`,
        message: 'card declined',
      },
    });
    expect(mockPrivateRequest).toHaveBeenCalledWith({
      method: EWebEmbedPrivateRequestMethod.closeWebViewModal,
    });
  });

  it('emits console message for DesktopIsolatedWebView when $onekey preload is absent', async () => {
    Object.defineProperty(globalThis, '$onekey', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      mockFallbackTrigger = 'stripeFormLoadFailed';
      mockPurchasePackageWeb.mockRejectedValueOnce(
        new Error('Stripe payment form failed to load'),
      );
      await act(async () => {
        render(<PrimePurchaseWebEmbedApp />);
      });
      expect(infoSpy).toHaveBeenCalledWith(
        `${PRIME_PURCHASE_CONSOLE_MESSAGE_PREFIX}${JSON.stringify({
          scope: '$private',
          data: {
            method: EWebEmbedPrivateRequestMethod.fallbackToPrimeHostedCheckout,
            params: {
              trigger: 'stripeFormLoadFailed',
              onekeyUserId: 'user-1',
              subscriptionPeriod: 'P1Y',
              currency: 'USD',
              featureName: undefined,
              purchasePackage: { identifier: '$rc_annual' },
            },
          },
        })}`,
      );
    } finally {
      infoSpy.mockRestore();
    }
  });
});
