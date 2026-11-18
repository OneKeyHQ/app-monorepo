/* cspell:ignore Infini infini rcbilling customerportal */
import {
  getPrimeSubscriptionManagementSourceKey,
  getPrimeSubscriptionManagementTarget,
} from './primeSubscriptionManagementUtils';

describe('primeSubscriptionManagementUtils', () => {
  it('routes Infini to the in-app management page regardless of its management URL', () => {
    expect(
      getPrimeSubscriptionManagementTarget({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions: [
              {
                channel: ' Infini ',
                managementUrl: 'https://apps.apple.com/account/subscriptions',
              },
            ],
          },
        },
      }),
    ).toEqual({ type: 'infini' });
  });

  it.each([
    {
      name: 'Apple subscription management',
      managementUrl: 'https://apps.apple.com/account/subscriptions',
      expectedUrl: 'https://apps.apple.com/account/subscriptions',
    },
    {
      name: 'Google Play subscription with sku and package',
      managementUrl:
        'https://play.google.com/store/account/subscriptions?sku=prime_monthly&package=so.onekey.app.wallet',
      expectedUrl:
        'https://play.google.com/store/account/subscriptions?sku=prime_monthly&package=so.onekey.app.wallet',
    },
    {
      name: 'RevenueCat web billing portal',
      managementUrl:
        'https://api.revenuecat.com/rcbilling/v1/customerportal/test-app/test-subscription/portal',
      expectedUrl:
        'https://api.revenuecat.com/rcbilling/v1/customerportal/test-app/test-subscription/portal',
    },
    {
      name: 'HTTPS management URL',
      managementUrl: ' https://example.com/manage ',
      expectedUrl: 'https://example.com/manage',
    },
  ])(
    'routes a channel-less $name externally',
    ({ managementUrl, expectedUrl }) => {
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
        url: expectedUrl,
      });
    },
  );

  it.each([
    {
      name: 'empty subscriptions',
      subscriptions: [],
    },
    {
      name: 'a null management URL',
      subscriptions: [{ managementUrl: null }],
    },
    {
      name: 'an empty management URL',
      subscriptions: [{ managementUrl: '' }],
    },
  ])('is unavailable for $name', ({ subscriptions }) => {
    expect(
      getPrimeSubscriptionManagementTarget({
        userInfo: {
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
            subscriptions,
          },
        },
      }),
    ).toEqual({ type: 'unavailable' });
  });

  it.each([
    {
      name: 'non-HTTPS URL',
      managementUrl: 'http://apps.apple.com/account/subscriptions',
    },
    {
      name: 'malformed URL',
      managementUrl: 'not-a-url',
    },
  ])('rejects a $name', ({ managementUrl }) => {
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
    ).toEqual({ type: 'unavailable' });
  });

  it.each([
    {
      name: 'Google HTTPS management entry',
      laterSubscription: {
        managementUrl:
          'https://play.google.com/store/account/subscriptions?sku=prime_monthly&package=so.onekey.app.wallet',
      },
      expected: {
        type: 'external' as const,
        url: 'https://play.google.com/store/account/subscriptions?sku=prime_monthly&package=so.onekey.app.wallet',
      },
    },
    {
      name: 'Infini entry with a null URL',
      laterSubscription: {
        channel: 'infini',
        managementUrl: null,
      },
      expected: { type: 'infini' as const },
    },
  ])(
    'skips a null-URL promotional entry before a $name',
    ({ laterSubscription, expected }) => {
      expect(
        getPrimeSubscriptionManagementTarget({
          userInfo: {
            primeSubscription: {
              isActive: true,
              expiresAt: Date.now() + 60_000,
              subscriptions: [{ managementUrl: null }, laterSubscription],
            },
          },
        }),
      ).toEqual(expected);
    },
  );

  it('is unavailable when Prime is inactive', () => {
    expect(
      getPrimeSubscriptionManagementTarget({
        userInfo: {
          primeSubscription: {
            isActive: false,
            expiresAt: Date.now() + 60_000,
            subscriptions: [
              {
                managementUrl: 'https://apps.apple.com/account/subscriptions',
              },
            ],
          },
        },
      }),
    ).toEqual({ type: 'unavailable' });
  });

  it('keeps the refresh key stable when the server only adds subscription ids', () => {
    const primeSubscription = {
      isActive: true,
      expiresAt: 1_700_000_000_000,
      subscriptions: [
        {
          channel: 'infini',
          managementUrl: null,
        },
      ],
    };

    expect(
      getPrimeSubscriptionManagementSourceKey({
        primeSubscription,
      }),
    ).toBe(
      getPrimeSubscriptionManagementSourceKey({
        primeSubscription: {
          ...primeSubscription,
          subscriptions: [
            {
              id: 'ok_prime_monthly_1',
              channel: ' Infini ',
              managementUrl: null,
            },
          ],
        },
      }),
    );
  });
});
