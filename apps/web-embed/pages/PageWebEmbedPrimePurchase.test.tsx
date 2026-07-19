/** @jest-environment jsdom */

import { cleanup, render, waitFor } from '@testing-library/react';

import { EWebEmbedPrivateRequestMethod } from '@onekeyhq/shared/src/consts/webEmbedConsts';

import PageWebEmbedPrimePurchase from './PageWebEmbedPrimePurchase';

const mockPurchasePackageWeb = jest.fn();
const mockPrivateRequest = jest.fn<Promise<unknown>, [unknown]>(
  async () => undefined,
);
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

jest.mock('@onekeyhq/kit/src/views/Prime/hooks/usePrimePaymentMethods', () => ({
  usePrimePaymentMethods: () => ({
    purchasePackageWeb: mockPurchasePackageWeb,
    webEmbedQueryParams: {
      apiKey: 'rc-key',
      locale: 'en-US',
      mode: 'prod',
      primeUserEmail: 'prime@example.com',
      primeUserId: 'user-a',
      subscriptionPeriod: 'P1Y',
    },
  }),
}));

describe('PageWebEmbedPrimePurchase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, '$onekey', {
      configurable: true,
      value: {
        $private: {
          request: mockPrivateRequest,
        },
      },
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  it('returns the original user id after an active paid or trial purchase', async () => {
    mockPurchasePackageWeb.mockResolvedValue({
      customerInfo: {
        entitlements: {
          active: {
            Prime: { isActive: true, periodType: 'TRIAL' },
          },
        },
      },
    });

    render(<PageWebEmbedPrimePurchase />);

    await waitFor(() =>
      expect(mockPrivateRequest).toHaveBeenCalledWith({
        method:
          EWebEmbedPrivateRequestMethod.closeWebViewModalAfterPrimePurchaseSuccess,
        params: { onekeyUserId: 'user-a' },
      }),
    );
  });

  it('only closes when checkout returns no active Prime entitlement', async () => {
    mockPurchasePackageWeb.mockResolvedValue({
      customerInfo: { entitlements: { active: {} } },
    });

    render(<PageWebEmbedPrimePurchase />);

    await waitFor(() =>
      expect(mockPrivateRequest).toHaveBeenCalledWith({
        method: EWebEmbedPrivateRequestMethod.closeWebViewModal,
      }),
    );
    expect(mockPrivateRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method:
          EWebEmbedPrivateRequestMethod.closeWebViewModalAfterPrimePurchaseSuccess,
      }),
    );
  });

  it('only closes after cancellation or failure', async () => {
    mockPurchasePackageWeb.mockRejectedValue(new Error('Purchase cancelled'));

    render(<PageWebEmbedPrimePurchase />);

    await waitFor(() =>
      expect(mockPrivateRequest).toHaveBeenCalledWith({
        method: EWebEmbedPrivateRequestMethod.closeWebViewModal,
      }),
    );
    expect(mockPrivateRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method:
          EWebEmbedPrivateRequestMethod.closeWebViewModalAfterPrimePurchaseSuccess,
      }),
    );
  });
});
