/* cspell:ignore Infini infini */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  getPrimeSubscriptionManagementTarget,
  resolvePrimeSubscriptionManagementTarget,
} from './primeSubscriptionManagementUtils';

const activeInfiniSubscription = {
  subscriptionId: 'infini-subscription-id',
  status: 'active',
  plan: 'monthly' as const,
  currentPeriodEnd: Date.now() + 60_000,
};

describe('primeSubscriptionManagementUtils', () => {
  it('routes an Infini channel to the in-app management page', () => {
    expect(
      getPrimeSubscriptionManagementTarget({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ channel: ' Infini ' }],
          },
          subscriptionManageUrl: 'https://example.com/manage',
        },
        isInfiniManageSupported: true,
      }),
    ).toEqual({ type: 'infini' });
  });

  it('routes a non-Infini subscription with a management URL externally', () => {
    expect(
      getPrimeSubscriptionManagementTarget({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ channel: 'app-store' }],
          },
          subscriptionManageUrl: ' https://example.com/manage ',
        },
        isInfiniManageSupported: true,
      }),
    ).toEqual({
      type: 'external',
      url: 'https://example.com/manage',
    });
  });

  it('identifies when the channel and management URL are both missing', () => {
    expect(
      getPrimeSubscriptionManagementTarget({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ managementUrl: undefined }],
          },
          subscriptionManageUrl: '',
        },
        isInfiniManageSupported: true,
      }),
    ).toEqual({
      type: 'unavailable',
      reason: 'missing-channel-and-management-url',
    });
  });

  it('uses the Infini lookup only when both routing fields remain missing after refresh', async () => {
    const fetchFreshUserInfo = jest.fn(async () => ({
      primeSubscription: {
        isActive: true,
        expiresAt: Date.now() + 60_000,
        subscriptions: [{ managementUrl: undefined }],
      },
      subscriptionManageUrl: '',
    }));
    const fetchInfiniSubscription = jest.fn(
      async () => activeInfiniSubscription,
    );

    await expect(
      resolvePrimeSubscriptionManagementTarget({
        currentUserInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ managementUrl: undefined }],
          },
          subscriptionManageUrl: '',
        },
        isInfiniManageSupported: true,
        fetchFreshUserInfo,
        fetchInfiniSubscription,
      }),
    ).resolves.toEqual({ type: 'infini' });
    expect(fetchFreshUserInfo).toHaveBeenCalledTimes(1);
    expect(fetchInfiniSubscription).toHaveBeenCalledTimes(1);
  });

  it('uses a refreshed Infini channel without calling the fallback', async () => {
    const fetchInfiniSubscription = jest.fn(async () => {
      throw new OneKeyLocalError('fallback failed');
    });

    await expect(
      resolvePrimeSubscriptionManagementTarget({
        currentUserInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ managementUrl: undefined }],
          },
          subscriptionManageUrl: '',
        },
        isInfiniManageSupported: true,
        fetchFreshUserInfo: async () => ({
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ channel: 'infini' }],
          },
          subscriptionManageUrl: '',
        }),
        fetchInfiniSubscription,
      }),
    ).resolves.toEqual({ type: 'infini' });
    expect(fetchInfiniSubscription).not.toHaveBeenCalled();
  });

  it('uses a refreshed management URL before the Infini fallback', async () => {
    const fetchInfiniSubscription = jest.fn(
      async () => activeInfiniSubscription,
    );

    await expect(
      resolvePrimeSubscriptionManagementTarget({
        currentUserInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ managementUrl: undefined }],
          },
          subscriptionManageUrl: '',
        },
        isInfiniManageSupported: true,
        fetchFreshUserInfo: async () => ({
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ managementUrl: undefined }],
          },
          subscriptionManageUrl: 'https://example.com/fresh-manage',
        }),
        fetchInfiniSubscription,
      }),
    ).resolves.toEqual({
      type: 'external',
      url: 'https://example.com/fresh-manage',
    });
    expect(fetchInfiniSubscription).not.toHaveBeenCalled();
  });

  it('does not use the Infini fallback when a channel is declared', async () => {
    const fetchInfiniSubscription = jest.fn(
      async () => activeInfiniSubscription,
    );

    await expect(
      resolvePrimeSubscriptionManagementTarget({
        currentUserInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ channel: 'app-store' }],
          },
          subscriptionManageUrl: '',
        },
        isInfiniManageSupported: true,
        fetchFreshUserInfo: async () => ({
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ channel: 'app-store' }],
          },
          subscriptionManageUrl: '',
        }),
        fetchInfiniSubscription,
      }),
    ).resolves.toEqual({
      type: 'unavailable',
      reason: 'channel-without-management-url',
    });
    expect(fetchInfiniSubscription).not.toHaveBeenCalled();
  });

  it('starts the Infini fallback after refresh when the channel disappears', async () => {
    const fetchInfiniSubscription = jest.fn(
      async () => activeInfiniSubscription,
    );

    await expect(
      resolvePrimeSubscriptionManagementTarget({
        currentUserInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ channel: 'app-store' }],
          },
          subscriptionManageUrl: '',
        },
        isInfiniManageSupported: true,
        fetchFreshUserInfo: async () => ({
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ managementUrl: undefined }],
          },
          subscriptionManageUrl: '',
        }),
        fetchInfiniSubscription,
      }),
    ).resolves.toEqual({ type: 'infini' });
    expect(fetchInfiniSubscription).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed Infini fallback instead of reporting missing data', async () => {
    const fallbackError = new OneKeyLocalError('Infini lookup failed');

    await expect(
      resolvePrimeSubscriptionManagementTarget({
        currentUserInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ managementUrl: undefined }],
          },
          subscriptionManageUrl: '',
        },
        isInfiniManageSupported: true,
        fetchFreshUserInfo: async () => ({
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ managementUrl: undefined }],
          },
          subscriptionManageUrl: '',
        }),
        fetchInfiniSubscription: async () => {
          throw fallbackError;
        },
      }),
    ).rejects.toBe(fallbackError);
  });

  it('surfaces a failed user-info refresh without starting the fallback', async () => {
    const refreshError = new OneKeyLocalError('User info refresh failed');
    const fetchInfiniSubscription = jest.fn(
      async () => activeInfiniSubscription,
    );

    await expect(
      resolvePrimeSubscriptionManagementTarget({
        currentUserInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ managementUrl: undefined }],
          },
          subscriptionManageUrl: '',
        },
        isInfiniManageSupported: true,
        fetchFreshUserInfo: async () => {
          throw refreshError;
        },
        fetchInfiniSubscription,
      }),
    ).rejects.toBe(refreshError);
    expect(fetchInfiniSubscription).not.toHaveBeenCalled();
  });
});
