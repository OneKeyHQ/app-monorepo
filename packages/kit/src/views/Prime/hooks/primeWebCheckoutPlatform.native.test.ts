import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { resolvePrimeWebCheckoutPackage } from './primeWebCheckoutPlatform.native';

const mockGet = jest.fn<Promise<{ data: unknown }>, [string, unknown]>();

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: (url: string, options: unknown) => mockGet(url, options) },
}));
jest.mock('react-native-purchases', () => ({ __esModule: true, default: {} }));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./revenueCatNativeCompatibility.native', () => ({}));
jest.mock('./getPrimePaymentApiKey', () => ({}));

const offering = {
  identifier: 'Default_offering',
  packages: [
    { identifier: '$rc_monthly', platform_product_identifier: 'monthly' },
    { identifier: 'custom-annual', platform_product_identifier: 'annual' },
  ],
};
const product = (
  identifier: string,
  duration: string,
  amountMicros: number,
) => ({
  identifier,
  product_type: 'subscription',
  default_purchase_option_id: 'base',
  purchase_options: {
    base: {
      base: {
        period_duration: duration,
        price: { amount_micros: amountMicros, currency: 'EUR' },
      },
    },
  },
});
const params = {
  config: {
    offeringId: 'Default_offering',
    baseUrl: 'https://pay.rev.cat/test/',
  },
  onekeyUserId: 'user-1',
  isSandbox: false,
  currency: 'EUR',
  subscriptionPeriod: 'P1Y' as const,
};

function respondWith(products: unknown) {
  mockGet
    .mockResolvedValueOnce({
      data: { current_offering_id: 'Default_offering', offerings: [offering] },
    })
    .mockResolvedValueOnce({ data: products });
}

beforeEach(() => {
  jest.resetAllMocks();
});

it('resolves package ID, period and price from independent RevenueCat responses', async () => {
  respondWith({
    product_details: [
      product('monthly', 'P1M', 12_000_000),
      product('annual', 'P1Y', 99_000_000),
    ],
  });

  await expect(resolvePrimeWebCheckoutPackage(params)).resolves.toEqual({
    packageId: 'custom-annual',
    offeringId: 'Default_offering',
    subscriptionPeriod: 'P1Y',
    amount: 99,
    currency: 'EUR',
  });
  expect(mockGet).toHaveBeenNthCalledWith(
    1,
    'https://api.revenuecat.com/v1/subscribers/user-1/offerings',
    expect.objectContaining({
      timeout: 10_000,
      headers: expect.objectContaining({
        'X-Platform': 'web',
        'X-Is-Sandbox': 'false',
      }),
    }),
  );
  expect(mockGet).toHaveBeenNthCalledWith(
    2,
    'https://api.revenuecat.com/rcbilling/v1/subscribers/user-1/products?id=monthly&id=annual&currency=EUR',
    expect.any(Object),
  );
});

it('uses the configured sandbox offering and key, and requests USD pricing', async () => {
  mockGet
    .mockResolvedValueOnce({
      data: {
        current_offering_id: 'other',
        offerings: [{ ...offering, identifier: 'Sandbox_testing' }],
      },
    })
    .mockResolvedValueOnce({
      data: { product_details: [product('annual', 'P1Y', 99_000_000)] },
    });

  await expect(
    resolvePrimeWebCheckoutPackage({
      ...params,
      isSandbox: true,
      config: { ...params.config, offeringId: 'Sandbox_testing' },
    }),
  ).resolves.toMatchObject({
    offeringId: 'Sandbox_testing',
    packageId: 'custom-annual',
  });
  expect(mockGet).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('&currency=USD'),
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: expect.stringContaining('Bearer rcb_sb_'),
        'X-Is-Sandbox': 'true',
      }),
    }),
  );
});

it('refuses another current offering before querying products', async () => {
  mockGet.mockResolvedValueOnce({
    data: { current_offering_id: 'other', offerings: [offering] },
  });

  await expect(resolvePrimeWebCheckoutPackage(params)).rejects.toThrow(
    'offering mismatch',
  );
  expect(mockGet).toHaveBeenCalledTimes(1);
});

it('does not infer a billing period from the package ID', async () => {
  respondWith({ product_details: [product('annual', 'P1M', 99_000_000)] });

  await expect(resolvePrimeWebCheckoutPackage(params)).rejects.toThrow(
    'no package for P1Y',
  );
});

it.each([
  { product_details: [] },
  { product_details: [product('annual', 'P1Y', Number.NaN)] },
  { product_details: [product('annual', 'P1Y', -1)] },
  {
    product_details: [
      {
        ...product('annual', 'P1Y', 99_000_000),
        default_purchase_option_id: 'missing',
      },
    ],
  },
])(
  'refuses products without a valid selected-period price: %j',
  async (response) => {
    respondWith(response);

    await expect(resolvePrimeWebCheckoutPackage(params)).rejects.toThrow(
      'no package for P1Y',
    );
  },
);

it('fails closed on an unreadable product response or network failure', async () => {
  respondWith({ product_details: null });
  await expect(resolvePrimeWebCheckoutPackage(params)).rejects.toThrow(
    'Invalid Prime web product response',
  );
  mockGet.mockRejectedValueOnce(new OneKeyLocalError('RevenueCat unavailable'));
  await expect(resolvePrimeWebCheckoutPackage(params)).rejects.toThrow(
    'RevenueCat unavailable',
  );
});
