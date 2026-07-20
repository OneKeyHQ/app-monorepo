/** @jest-environment jsdom */

import { waitFor } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IKytIntroClaimResult } from '@onekeyhq/shared/types/kyt';

import {
  finishPrimeSubscriptionPurchaseSuccess,
  handlePrimePurchaseSuccessCloseRequest,
  preparePrimeSubscriptionPurchaseSuccess,
} from './primeSubscriptionPurchaseSuccess';

const mockFetchPrimeUserInfo = jest.fn<Promise<void>, []>();
const mockTryClaimKytIntro = jest.fn<
  Promise<IKytIntroClaimResult>,
  [unknown]
>();
const mockPurchaseSuccessListener = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      apiFetchPrimeUserInfo: () => mockFetchPrimeUserInfo(),
    },
    serviceSetting: {
      tryClaimKytIntro: (params: unknown) => mockTryClaimKytIntro(params),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      usage: { primeReceiveKytIntroFlowFailed: jest.fn() },
    },
  },
}));

describe('Prime subscription purchase success', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPrimeUserInfo.mockResolvedValue(undefined);
    mockTryClaimKytIntro.mockResolvedValue({
      status: 'claimed',
      claimId: 'purchase-claim',
      entryPoint: 'primeSubscribeSuccess',
    });
    appEventBus.on(
      EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
      mockPurchaseSuccessListener,
    );
  });

  afterEach(() => {
    appEventBus.off(
      EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
      mockPurchaseSuccessListener,
    );
  });

  it('reserves before refresh and emits only after refresh', async () => {
    const payload = await preparePrimeSubscriptionPurchaseSuccess('user-a');
    await finishPrimeSubscriptionPurchaseSuccess(payload);

    expect(payload).toEqual({
      claimId: 'purchase-claim',
      onekeyUserId: 'user-a',
    });
    expect(mockTryClaimKytIntro.mock.invocationCallOrder[0]).toBeLessThan(
      mockFetchPrimeUserInfo.mock.invocationCallOrder[0],
    );
    expect(mockFetchPrimeUserInfo.mock.invocationCallOrder[0]).toBeLessThan(
      mockPurchaseSuccessListener.mock.invocationCallOrder[0],
    );
  });

  it('refreshes without emitting when checkout did not confirm a purchase', async () => {
    await finishPrimeSubscriptionPurchaseSuccess(undefined);

    expect(mockFetchPrimeUserInfo).toHaveBeenCalledTimes(1);
    expect(mockPurchaseSuccessListener).not.toHaveBeenCalled();
  });

  it('validates the Android callback and keeps confirmed purchases on refresh failure', async () => {
    const pop = jest.fn();
    mockFetchPrimeUserInfo.mockRejectedValueOnce(
      new Error('RevenueCat webhook is delayed'),
    );

    handlePrimePurchaseSuccessCloseRequest({
      params: { onekeyUserId: 'user-a' },
      hashRoutePath: '/prime/purchase',
      routePrimeUserId: 'user-a',
      isWebEmbed: true,
      pop,
    });

    expect(mockTryClaimKytIntro.mock.invocationCallOrder[0]).toBeLessThan(
      pop.mock.invocationCallOrder[0],
    );
    await waitFor(() =>
      expect(mockPurchaseSuccessListener).toHaveBeenCalledWith({
        claimId: 'purchase-claim',
        onekeyUserId: 'user-a',
      }),
    );
  });

  it('only closes an Android callback for a mismatched user', async () => {
    const pop = jest.fn();

    handlePrimePurchaseSuccessCloseRequest({
      params: { onekeyUserId: 'user-b' },
      hashRoutePath: '/prime/purchase',
      routePrimeUserId: 'user-a',
      isWebEmbed: true,
      pop,
    });

    expect(pop).toHaveBeenCalledTimes(1);
    expect(mockTryClaimKytIntro).not.toHaveBeenCalled();
    expect(mockFetchPrimeUserInfo).not.toHaveBeenCalled();
    expect(mockPurchaseSuccessListener).not.toHaveBeenCalled();
  });
});
