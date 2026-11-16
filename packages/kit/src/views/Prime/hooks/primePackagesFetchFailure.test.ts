import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  getPrimePackagesFailureDescriptionId,
  getPrimePackagesFailureKind,
  getPrimeStorefrontCountryCode,
} from './primePackagesFetchFailure';

let mockIsAppleStore = true;
jest.mock('@onekeyhq/shared/src/prime/primePaymentCapabilities', () => ({
  isPrimeAppleStorePayment: () => mockIsAppleStore,
}));

describe('Prime packages fail state copy', () => {
  it('uses the China copy only for unavailable products on a CHN Apple Storefront', () => {
    mockIsAppleStore = true;
    expect(
      getPrimePackagesFailureDescriptionId({
        kind: 'productUnavailable',
        storefrontCountryCode: 'CHN',
      }),
    ).toBe(ETranslations.prime_subscription_china_storefront__msg);
    expect(
      getPrimePackagesFailureDescriptionId({
        kind: 'productUnavailable',
        storefrontCountryCode: 'USA',
      }),
    ).toBe(ETranslations.prime_plans_app_store_no_plans__desc);
    expect(
      getPrimePackagesFailureDescriptionId({
        kind: 'network',
        storefrontCountryCode: 'CHN',
      }),
    ).toBe(ETranslations.prime_plans_network_error__desc);
  });
});

describe('Prime packages fail state classification', () => {
  it.each([
    ['10', 'network'],
    ['32', 'network'],
    ['33', 'network'],
    ['35', 'network'],
    ['2', 'storeUnavailable'],
    ['3', 'purchaseNotAllowed'],
    ['5', 'productUnavailable'],
    ['23', 'unknown'],
    ['16', 'unknown'],
    [undefined, 'unknown'],
  ] as const)('maps RevenueCat code %s to %s', (errorCode, kind) => {
    expect(
      getPrimePackagesFailureKind({
        errorCode,
        underlyingErrorCategory: 'unknown',
      }),
    ).toBe(kind);
  });

  it('prefers a network cause kept under a configuration error', () => {
    expect(
      getPrimePackagesFailureKind({
        errorCode: '23',
        underlyingErrorCategory: 'network',
      }),
    ).toBe('network');
  });

  it('treats an empty offering as product unavailable', () => {
    expect(
      getPrimePackagesFailureKind({
        underlyingErrorCategory: 'unknown',
        isEmptyOffering: true,
      }),
    ).toBe('productUnavailable');
  });

  it('uses product guidance only for a product-specific configuration failure', () => {
    expect(
      getPrimePackagesFailureKind({
        errorCode: '23',
        underlyingErrorCategory: 'productUnavailable',
      }),
    ).toBe('productUnavailable');
    const kind = getPrimePackagesFailureKind({
      errorCode: '23',
      underlyingErrorCategory: 'storeConfig',
    });
    expect(kind).toBe('unknown');
    expect(
      getPrimePackagesFailureDescriptionId({
        kind,
        storefrontCountryCode: 'CHN',
      }),
    ).toBeUndefined();
  });
});

describe('Prime Storefront country for analytics', () => {
  it.each(['CHN', 'USA', 'US'])('keeps %s', async (countryCode) => {
    await expect(
      getPrimeStorefrontCountryCode(async () => ({ countryCode })),
    ).resolves.toBe(countryCode);
  });

  it.each(['', 'cn', 'CN-1'])('drops %j', async (countryCode) => {
    await expect(
      getPrimeStorefrontCountryCode(async () => ({ countryCode })),
    ).resolves.toBeUndefined();
  });

  it('returns undefined when Storefront is missing or fails', async () => {
    await expect(getPrimeStorefrontCountryCode()).resolves.toBeUndefined();
    await expect(
      getPrimeStorefrontCountryCode(async () => null),
    ).resolves.toBeUndefined();
    await expect(
      getPrimeStorefrontCountryCode(async () => {
        throw new OneKeyLocalError('unavailable');
      }),
    ).resolves.toBeUndefined();
  });
});
