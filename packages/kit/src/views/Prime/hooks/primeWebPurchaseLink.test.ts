import {
  PRIME_WEB_PURCHASE_LINK_PRODUCTION,
  PRIME_WEB_PURCHASE_LINK_SANDBOX,
} from '@onekeyhq/shared/src/consts/primeConsts';

import {
  buildPrimeWebPurchaseLinkUrl,
  getPrimeWebPurchaseLinkConfig,
  isPrimeWebPurchaseLinkPageUrl,
  parsePrimeWebPurchaseLinkPackage,
  resolvePrimeWebPurchaseLinkPackage,
  withPrimeWebPurchaseLinkEmail,
} from './primeWebPurchaseLink';

/*
yarn test packages/kit/src/views/Prime/hooks/primeWebPurchaseLink.test.ts
*/

const offering = {
  identifier: 'Sandbox_testing',
  availablePackages: [
    {
      identifier: '$rc_monthly',
      rcBillingProduct: {
        normalPeriodDuration: 'P1M',
        currentPrice: { amountMicros: 9_990_000, currency: 'USD' },
      },
    },
    {
      identifier: '$rc_annual',
      rcBillingProduct: {
        normalPeriodDuration: 'P1Y',
        currentPrice: { amountMicros: 99_000_000, currency: 'EUR' },
      },
    },
  ],
};

describe('primeWebPurchaseLink', () => {
  it('selects the sandbox link only for sandbox checkouts', () => {
    expect(getPrimeWebPurchaseLinkConfig({ isSandbox: true })).toBe(
      PRIME_WEB_PURCHASE_LINK_SANDBOX,
    );
    expect(getPrimeWebPurchaseLinkConfig({ isSandbox: false })).toBe(
      PRIME_WEB_PURCHASE_LINK_PRODUCTION,
    );
  });

  describe('resolvePrimeWebPurchaseLinkPackage', () => {
    it('resolves the package of the selected period', () => {
      expect(
        resolvePrimeWebPurchaseLinkPackage({
          config: { baseUrl: 'https://pay.rev.cat/x/', offeringId: undefined },
          targetOffering: offering,
          subscriptionPeriod: 'P1Y',
        }),
      ).toEqual({
        packageId: '$rc_annual',
        offeringId: 'Sandbox_testing',
        subscriptionPeriod: 'P1Y',
        amount: 99,
        currency: 'EUR',
      });
    });

    it('refuses packages from another offering', () => {
      expect(() =>
        resolvePrimeWebPurchaseLinkPackage({
          config: { baseUrl: 'https://pay.rev.cat/x/', offeringId: 'default' },
          targetOffering: offering,
          subscriptionPeriod: 'P1Y',
        }),
      ).toThrow('offering mismatch');
    });

    it('refuses a missing offering or period', () => {
      const config = {
        baseUrl: 'https://pay.rev.cat/x/',
        offeringId: undefined,
      };
      expect(() =>
        resolvePrimeWebPurchaseLinkPackage({
          config,
          targetOffering: undefined,
          subscriptionPeriod: 'P1Y',
        }),
      ).toThrow('no offering');
      expect(() =>
        resolvePrimeWebPurchaseLinkPackage({
          config,
          targetOffering: { ...offering, availablePackages: [] },
          subscriptionPeriod: 'P1M',
        }),
      ).toThrow('no package');
    });
  });

  describe('buildPrimeWebPurchaseLinkUrl', () => {
    it('appends the encoded OneKey ID and checkout params', () => {
      expect(
        buildPrimeWebPurchaseLinkUrl({
          config: PRIME_WEB_PURCHASE_LINK_PRODUCTION,
          onekeyUserId: 'user/1',
          packageId: '$rc_annual',
          currency: 'EUR',
          platform: 'extension',
          featureName: 'BulkCopyAddresses',
        }),
      ).toBe(
        'https://pay.rev.cat/idlgwwbqaqvdevzv/user%2F1?package_id=%24rc_annual&currency=EUR&skip_purchase_success=true&utm_source=onekey_extension&utm_campaign=BulkCopyAddresses',
      );
    });

    it('adds the trailing slash and skips empty optional params', () => {
      expect(
        buildPrimeWebPurchaseLinkUrl({
          config: {
            baseUrl: 'https://pay.rev.cat/sandbox/abc',
            offeringId: undefined,
          },
          onekeyUserId: 'u1',
          packageId: '$rc_monthly',
          platform: 'web',
        }),
      ).toBe(
        'https://pay.rev.cat/sandbox/abc/u1?package_id=%24rc_monthly&skip_purchase_success=true&utm_source=onekey_web',
      );
    });

    it('requires a OneKey ID', () => {
      expect(() =>
        buildPrimeWebPurchaseLinkUrl({
          config: PRIME_WEB_PURCHASE_LINK_SANDBOX,
          onekeyUserId: '',
          packageId: '$rc_monthly',
          platform: 'web',
        }),
      ).toThrow('missing OneKey ID');
    });
  });

  describe('parsePrimeWebPurchaseLinkPackage', () => {
    const config = {
      baseUrl: 'https://pay.rev.cat/sandbox/abc/',
      offeringId: 'Sandbox_testing',
    };
    const value = {
      packageId: '$rc_annual',
      offeringId: 'Sandbox_testing',
      subscriptionPeriod: 'P1Y',
      amount: 99,
      currency: 'USD',
    };

    it('accepts a package of the link offering and selected plan', () => {
      expect(
        parsePrimeWebPurchaseLinkPackage({
          config,
          subscriptionPeriod: 'P1Y',
          value,
        }),
      ).toEqual(value);
    });

    it.each([
      ['another offering', { ...value, offeringId: 'Default_offering' }],
      ['another plan', { ...value, subscriptionPeriod: 'P1M' }],
      ['a missing period', { ...value, subscriptionPeriod: undefined }],
      ['a missing package', { ...value, packageId: '' }],
      ['a non-numeric amount', { ...value, amount: '99' }],
      ['no value', undefined],
    ])('rejects %s', (_label, input) => {
      expect(
        parsePrimeWebPurchaseLinkPackage({
          config,
          subscriptionPeriod: 'P1Y',
          value: input,
        }),
      ).toBeUndefined();
    });
  });

  describe('withPrimeWebPurchaseLinkEmail', () => {
    it('adds the encoded email only when opening the link', () => {
      expect(
        withPrimeWebPurchaseLinkEmail(
          'https://pay.rev.cat/abc/u1?package_id=%24rc_annual',
          'a+b@example.com',
        ),
      ).toBe(
        'https://pay.rev.cat/abc/u1?package_id=%24rc_annual&email=a%2Bb%40example.com',
      );
      expect(
        withPrimeWebPurchaseLinkEmail('https://pay.rev.cat/abc/u1', undefined),
      ).toBe('https://pay.rev.cat/abc/u1');
    });
  });

  it('recognizes pages of the hosted checkout origin', () => {
    expect(
      isPrimeWebPurchaseLinkPageUrl('https://pay.rev.cat/sandbox/abc/u1'),
    ).toBe(true);
    expect(isPrimeWebPurchaseLinkPageUrl('https://example.com/pay')).toBe(
      false,
    );
    expect(isPrimeWebPurchaseLinkPageUrl('https://pay.rev.cat.evil.io/')).toBe(
      false,
    );
    expect(isPrimeWebPurchaseLinkPageUrl(undefined)).toBe(false);
  });
});
