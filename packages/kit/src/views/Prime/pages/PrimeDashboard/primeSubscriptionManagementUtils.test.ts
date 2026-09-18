/* cspell:ignore Infini infini rcbilling customerportal */
import {
  getPrimeSubscriptionManagementSourceKey,
  getPrimeSubscriptionManagementTarget,
  hasRevenueCatSubscriptionChannel,
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

  it.each([
    {
      name: 'RevenueCat web billing portal',
      managementUrl:
        'https://api.revenuecat.com/rcbilling/v1/customerportal/test-app/test-subscription/portal',
    },
    {
      name: 'Apple subscription management',
      managementUrl: 'https://apps.apple.com/account/subscriptions',
    },
  ])('routes a channel-less $name URL externally', ({ managementUrl }) => {
    expect(
      getPrimeSubscriptionManagementTarget({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: 0,
            subscriptions: [{ managementUrl }],
          },
        },
      }),
    ).toEqual({
      type: 'external',
      url: managementUrl,
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

  it('prefers Infini in-app management over a preceding channel-less store URL', () => {
    expect(
      getPrimeSubscriptionManagementTarget({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [
              {
                managementUrl: 'https://apps.apple.com/account/subscriptions',
              },
              {
                channel: 'infini',
                managementUrl: 'https://onekey.so/invite',
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
