/* cspell:ignore Infini infini */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  getPrimeSubscriptionManagementSourceKey,
  getPrimeSubscriptionManagementTarget,
  hasRevenueCatSubscriptionChannel,
  shouldOpenInfiniSubscriptionAfterDashboardLogin,
  shouldToastUnsupportedManagementAfterUserInfoRefresh,
  shouldToastUnsupportedPrimeSubscriptionManagement,
} from './primeSubscriptionManagementUtils';

describe('primeSubscriptionManagementUtils', () => {
  it('routes Infini to the in-app management page and ignores its marketing URL', () => {
    expect(
      getPrimeSubscriptionManagementTarget({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [
              {
                channel: ' Infini ',
                managementUrl: 'https://onekey.so/invite',
              },
            ],
          },
          subscriptionManageUrl: 'https://onekey.so/invite',
        },
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
            subscriptions: [
              {
                channel: 'app-store',
                managementUrl: ' https://example.com/manage ',
              },
            ],
          },
        },
      }),
    ).toEqual({
      type: 'external',
      url: 'https://example.com/manage',
    });
  });

  it('does not open a marketing URL when the subscription has no channel', () => {
    expect(
      getPrimeSubscriptionManagementTarget({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [
              {
                managementUrl: 'https://onekey.so/invite',
              },
            ],
          },
        },
      }),
    ).toEqual({
      type: 'unavailable',
      reason: 'missing-channel-and-management-url',
    });
  });

  it('does not use an aggregate management URL for a redemption subscription', () => {
    expect(
      getPrimeSubscriptionManagementTarget({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [
              {
                channel: 'redemption',
                managementUrl: 'https://onekey.so/invite',
              },
            ],
          },
          subscriptionManageUrl: 'https://example.com/stale-manage',
        },
      }),
    ).toEqual({
      type: 'unavailable',
      reason: 'channel-without-management-url',
    });
  });

  it('prefers Infini in-app management when a store URL is also present', () => {
    expect(
      getPrimeSubscriptionManagementTarget({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [
              {
                channel: 'infini',
                managementUrl: 'https://onekey.so/invite',
              },
              {
                channel: 'app-store',
                managementUrl: 'https://apps.apple.com/account/subscriptions',
              },
            ],
          },
        },
      }),
    ).toEqual({ type: 'infini' });
  });

  it('detects a RevenueCat channel for SDK URL hydration', () => {
    expect(
      hasRevenueCatSubscriptionChannel({
        subscriptions: [{ channel: ' RevenueCat ' }],
      }),
    ).toBe(true);
    expect(
      hasRevenueCatSubscriptionChannel({
        subscriptions: [{ channel: 'redemption' }],
      }),
    ).toBe(false);
  });

  it('uses the RevenueCat URL only for a current RevenueCat subscription', () => {
    expect(
      getPrimeSubscriptionManagementTarget({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ channel: ' RevenueCat ' }],
          },
          subscriptionManageUrl: ' https://example.com/revenuecat-manage ',
        },
      }),
    ).toEqual({
      type: 'external',
      url: 'https://example.com/revenuecat-manage',
    });
  });

  it('toasts unsupported management only for a non-Infini paid channel', () => {
    expect(
      shouldToastUnsupportedPrimeSubscriptionManagement({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [
              {
                channel: 'app-store',
                managementUrl: 'https://example.com/manage',
              },
            ],
          },
        },
      }),
    ).toBe(true);
    expect(
      shouldToastUnsupportedPrimeSubscriptionManagement({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ channel: 'redemption' }],
          },
        },
      }),
    ).toBe(true);
    expect(
      shouldToastUnsupportedPrimeSubscriptionManagement({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ channel: 'infini' }],
          },
        },
      }),
    ).toBe(false);
    expect(
      shouldToastUnsupportedPrimeSubscriptionManagement({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ managementUrl: 'https://onekey.so/invite' }],
          },
        },
      }),
    ).toBe(false);
  });

  it('opens Infini after dashboard login only when persist and service agree', () => {
    expect(
      shouldOpenInfiniSubscriptionAfterDashboardLogin({
        fromDeepLink: true,
        didOpen: false,
        isAuthReady: true,
        persistLoggedIn: true,
        isServiceLoggedIn: true,
      }),
    ).toBe(true);
    expect(
      shouldOpenInfiniSubscriptionAfterDashboardLogin({
        fromDeepLink: true,
        didOpen: false,
        isAuthReady: true,
        persistLoggedIn: true,
        isServiceLoggedIn: false,
      }),
    ).toBe(false);
    expect(
      shouldOpenInfiniSubscriptionAfterDashboardLogin({
        fromDeepLink: true,
        didOpen: true,
        isAuthReady: true,
        persistLoggedIn: true,
        isServiceLoggedIn: true,
      }),
    ).toBe(false);
    expect(
      shouldOpenInfiniSubscriptionAfterDashboardLogin({
        fromDeepLink: false,
        didOpen: false,
        isAuthReady: true,
        persistLoggedIn: true,
        isServiceLoggedIn: true,
      }),
    ).toBe(false);
    expect(
      shouldOpenInfiniSubscriptionAfterDashboardLogin({
        fromDeepLink: true,
        didOpen: false,
        isAuthReady: false,
        persistLoggedIn: true,
        isServiceLoggedIn: true,
      }),
    ).toBe(false);
    expect(
      shouldOpenInfiniSubscriptionAfterDashboardLogin({
        fromDeepLink: true,
        didOpen: false,
        isAuthReady: true,
        persistLoggedIn: false,
        isServiceLoggedIn: true,
      }),
    ).toBe(false);
  });

  it('toasts unsupported management only after a confirmed userInfo refresh', async () => {
    await expect(
      shouldToastUnsupportedManagementAfterUserInfoRefresh({
        fetchUserInfo: async () => ({
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [
              {
                channel: 'app-store',
                managementUrl: 'https://example.com/manage',
              },
            ],
          },
        }),
      }),
    ).resolves.toBe(true);
    await expect(
      shouldToastUnsupportedManagementAfterUserInfoRefresh({
        fetchUserInfo: async () => ({
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [{ channel: 'infini' }],
          },
        }),
      }),
    ).resolves.toBe(false);
    await expect(
      shouldToastUnsupportedManagementAfterUserInfoRefresh({
        fetchUserInfo: async () => undefined,
      }),
    ).resolves.toBe(false);
    await expect(
      shouldToastUnsupportedManagementAfterUserInfoRefresh({
        fetchUserInfo: async () => {
          throw new OneKeyLocalError('network');
        },
      }),
    ).resolves.toBe(false);
  });

  it('keeps the refresh key stable when the server only adds subscription ids', () => {
    const primeSubscription = {
      isActive: true,
      expiresAt: 1_700_000_000_000,
      subscriptions: [
        {
          channel: 'infini',
          managementUrl: 'https://onekey.so/invite',
        },
      ],
    };
    const subscriptionManageUrl = 'https://onekey.so/invite';

    expect(
      getPrimeSubscriptionManagementSourceKey({
        primeSubscription,
        subscriptionManageUrl,
      }),
    ).toBe(
      getPrimeSubscriptionManagementSourceKey({
        primeSubscription: {
          ...primeSubscription,
          subscriptions: [
            {
              id: 'ok_prime_monthly_1',
              channel: ' Infini ',
              managementUrl: ' https://onekey.so/invite ',
            },
          ],
        },
        subscriptionManageUrl: ' https://onekey.so/invite ',
      }),
    );
  });
});
