import type { IPrimeWebCheckoutPendingSession } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  checkPrimeWebCheckout,
  settlePrimeWebCheckout,
} from './primeWebCheckout';

import type { IntlShape } from 'react-intl';

/*
yarn test packages/kit/src/views/Prime/hooks/primeWebCheckout.test.ts
*/

const mockGetLocalUserInfo = jest.fn<
  Promise<{ isLoggedIn: boolean; onekeyUserId: string }>,
  []
>();
const mockClearWebCheckoutPendingSession = jest.fn<Promise<boolean>, [unknown]>(
  async () => true,
);
const mockFetchPrimeWebCheckoutEntitlement = jest.fn<
  Promise<unknown>,
  [unknown]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      getLocalUserInfo: () => mockGetLocalUserInfo(),
    },
    simpleDb: {
      prime: {
        clearWebCheckoutPendingSession: (params: unknown) =>
          mockClearWebCheckoutPendingSession(params),
      },
    },
  },
}));

jest.mock('@onekeyhq/components', () => ({
  Toast: { message: jest.fn(), success: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeWebCheckoutFlow: jest.fn(),
        primeSubscribeSuccess: jest.fn(),
      },
    },
  },
}));

jest.mock('../primeSubscriptionPurchaseSuccess', () => ({
  finishPrimeSubscriptionPurchaseSuccess: jest.fn(),
  preparePrimeSubscriptionPurchaseSuccess: jest.fn(async () => ({})),
  refreshPrimeUserInfoAfterPurchase: jest.fn(async () => undefined),
}));

jest.mock('./primeWebCheckoutPlatform', () => ({
  fetchPrimeWebCheckoutEntitlement: (params: unknown) =>
    mockFetchPrimeWebCheckoutEntitlement(params),
}));

const session: IPrimeWebCheckoutPendingSession = {
  checkoutId: 'checkout-1',
  onekeyUserId: 'user-1',
  subscriptionPeriod: 'P1Y',
  packageId: '$rc_annual',
  offeringId: 'Sandbox_testing',
  amount: 99,
  currency: 'USD',
  isSandbox: true,
  platform: 'extension',
  checkoutUrl: 'https://pay.rev.cat/sandbox/abc/user-1',
  startedAt: Date.now(),
};
const intl = { formatMessage: jest.fn(() => '') } as unknown as IntlShape;
const loggedIn = (onekeyUserId: string) => ({ isLoggedIn: true, onekeyUserId });

describe('primeWebCheckout purchase user guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks RevenueCat for the purchase user', async () => {
    mockGetLocalUserInfo.mockResolvedValue(loggedIn('user-1'));
    mockFetchPrimeWebCheckoutEntitlement.mockResolvedValue(undefined);

    await expect(checkPrimeWebCheckout(session)).resolves.toEqual({
      status: 'pending',
    });
    expect(mockFetchPrimeWebCheckoutEntitlement).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      isSandbox: true,
    });
  });

  it('never queries RevenueCat once the user changed', async () => {
    mockGetLocalUserInfo.mockResolvedValue(loggedIn('user-2'));

    await expect(checkPrimeWebCheckout(session)).rejects.toThrow(
      'Prime purchase user changed',
    );
    expect(mockFetchPrimeWebCheckoutEntitlement).not.toHaveBeenCalled();
  });

  it('drops a result when the user changed during the request', async () => {
    mockGetLocalUserInfo
      .mockResolvedValueOnce(loggedIn('user-1'))
      .mockResolvedValueOnce({ isLoggedIn: false, onekeyUserId: '' });
    mockFetchPrimeWebCheckoutEntitlement.mockResolvedValue(undefined);

    await expect(checkPrimeWebCheckout(session)).rejects.toThrow(
      'Prime purchase user changed',
    );
  });

  it('never settles a checkout for a user who logged out', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: false,
      onekeyUserId: '',
    });

    await expect(
      settlePrimeWebCheckout({
        session,
        intl,
        result: {
          status: 'succeeded',
          entitlement: {
            isActive: true,
            store: 'rc_billing',
            latestPurchaseDate: new Date(),
            isSandbox: true,
            periodType: 'normal',
            productIdentifier: 'prime_yearly',
          },
        },
      }),
    ).rejects.toThrow('Prime purchase user changed');
    expect(mockClearWebCheckoutPendingSession).not.toHaveBeenCalled();
  });
});
