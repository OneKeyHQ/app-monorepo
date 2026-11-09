import { shouldShowPrimeChinaStorefrontHint } from './primeChinaStorefront';

const unavailableProducts = {
  code: '23',
  message:
    'None of the products registered in the RevenueCat dashboard could be fetched',
};

describe('Prime China App Store hint', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each([unavailableProducts, { code: 5 }])(
    'shows the hint for unavailable products and CHN: %j',
    async (error) => {
      await expect(
        shouldShowPrimeChinaStorefrontHint(error, async () => ({
          countryCode: 'CHN',
        })),
      ).resolves.toBe(true);
    },
  );

  it.each(['USA', 'HKG', 'TWN', 'CN', ''])(
    'uses the generic fallback for Storefront %s',
    async (countryCode) => {
      await expect(
        shouldShowPrimeChinaStorefrontHint(unavailableProducts, async () => ({
          countryCode,
        })),
      ).resolves.toBe(false);
    },
  );

  it.each([
    { code: '10', message: unavailableProducts.message },
    { code: '35' },
    { code: '32' },
    { code: '2' },
    { code: '23', message: 'Invalid RevenueCat configuration' },
    null,
    undefined,
  ])('keeps other errors on the generic fallback: %j', async (error) => {
    const getStorefront = jest.fn(async () => ({ countryCode: 'CHN' }));
    await expect(
      shouldShowPrimeChinaStorefrontHint(error, getStorefront),
    ).resolves.toBe(false);
    expect(getStorefront).not.toHaveBeenCalled();
  });

  it('supports a missing native method, null Storefront, and a rejected lookup', async () => {
    await expect(
      shouldShowPrimeChinaStorefrontHint(unavailableProducts),
    ).resolves.toBe(false);
    await expect(
      shouldShowPrimeChinaStorefrontHint(unavailableProducts, async () => null),
    ).resolves.toBe(false);
    const error = new Error('Unsupported native method');
    await expect(
      shouldShowPrimeChinaStorefrontHint(unavailableProducts, async () => {
        throw error;
      }),
    ).resolves.toBe(false);
  });

  it('bounds a stalled native lookup and keeps the generic fallback', async () => {
    const result = shouldShowPrimeChinaStorefrontHint(
      unavailableProducts,
      () => new Promise(() => {}),
    );
    await jest.advanceTimersByTimeAsync(1500);
    await expect(result).resolves.toBe(false);
  });
});
