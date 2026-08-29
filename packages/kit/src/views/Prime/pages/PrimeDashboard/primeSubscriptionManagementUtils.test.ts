/* cspell:ignore Infini infini */
import { getPrimeSubscriptionManagementTarget } from './primeSubscriptionManagementUtils';

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
            subscriptions: [
              {
                channel: 'app-store',
                managementUrl: ' https://example.com/manage ',
              },
            ],
          },
        },
        isInfiniManageSupported: true,
      }),
    ).toEqual({
      type: 'external',
      url: 'https://example.com/manage',
    });
  });

  it('ignores an aggregate management URL when the current subscription has no target', () => {
    const userInfo = {
      primeSubscription: {
        isActive: true,
        expiresAt: Date.now() + 60_000,
        subscriptions: [{ channel: 'redemption' }],
      },
      subscriptionManageUrl: 'https://example.com/stale-manage',
    };

    expect(
      getPrimeSubscriptionManagementTarget({
        userInfo,
        isInfiniManageSupported: true,
      }),
    ).toEqual({
      type: 'unavailable',
      reason: 'channel-without-management-url',
    });
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
        isInfiniManageSupported: true,
      }),
    ).toEqual({
      type: 'external',
      url: 'https://example.com/revenuecat-manage',
    });
  });
});
