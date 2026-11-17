import type { IPrimeWebCheckoutPendingSession } from '@onekeyhq/shared/types/prime/primeTypes';

import { retirePrimeWebCheckout } from './retirePrimeWebCheckout';

const session: IPrimeWebCheckoutPendingSession = {
  checkoutId: 'old-checkout',
  onekeyUserId: 'user-1',
  subscriptionPeriod: 'P1Y',
  packageId: '$rc_annual',
  offeringId: 'Default_offering',
  amount: 99,
  currency: 'USD',
  isSandbox: false,
  platform: 'desktop',
  checkoutUrl: 'https://pay.rev.cat/example/user-1',
  startedAt: Date.now(),
};
let mockPending: IPrimeWebCheckoutPendingSession | undefined;
const mockUser = jest.fn(async () => ({
  isLoggedIn: true,
  onekeyUserId: 'user-1',
}));
const mockRead = jest.fn<
  Promise<IPrimeWebCheckoutPendingSession | undefined>,
  [unknown]
>();
const mockClear = jest.fn<
  Promise<boolean>,
  [{ onekeyUserId: string; expectedCheckoutId: string }]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: { getLocalUserInfo: () => mockUser() },
    simpleDb: {
      prime: {
        getWebCheckoutPendingSession: (params: unknown) => mockRead(params),
        clearWebCheckoutPendingSession: (params: {
          onekeyUserId: string;
          expectedCheckoutId: string;
        }) => mockClear(params),
      },
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPending = session;
  mockUser.mockResolvedValue({ isLoggedIn: true, onekeyUserId: 'user-1' });
  mockRead.mockImplementation(async () => mockPending);
  mockClear.mockImplementation(async ({ expectedCheckoutId }) => {
    if (mockPending?.checkoutId !== expectedCheckoutId) return false;
    mockPending = undefined;
    return true;
  });
});

it('retires only the captured hosted record before embedded payment', async () => {
  await retirePrimeWebCheckout('user-1');
  expect(mockClear).toHaveBeenCalledWith({
    onekeyUserId: 'user-1',
    expectedCheckoutId: 'old-checkout',
  });
  expect(mockPending).toBeUndefined();
});

it('allows a fresh embedded attempt when no hosted record exists', async () => {
  mockPending = undefined;
  await expect(retirePrimeWebCheckout('user-1')).resolves.toBeUndefined();
  expect(mockClear).not.toHaveBeenCalled();
});

it('keeps a racing replacement and continues the embedded payment', async () => {
  const replacement = { ...session, checkoutId: 'new-checkout' };
  mockClear.mockImplementationOnce(async () => {
    mockPending = replacement;
    return false;
  });
  await expect(retirePrimeWebCheckout('user-1')).resolves.toBeUndefined();
  expect(mockPending).toBe(replacement);
});

it('does not retire the previous account after an identity change', async () => {
  mockUser.mockResolvedValue({ isLoggedIn: true, onekeyUserId: 'user-2' });
  await expect(retirePrimeWebCheckout('user-1')).rejects.toThrow(
    'user changed',
  );
  expect(mockClear).not.toHaveBeenCalled();
});

it('does not continue after the account changes during retirement', async () => {
  mockUser.mockResolvedValueOnce({ isLoggedIn: true, onekeyUserId: 'user-1' });
  mockUser.mockResolvedValueOnce({ isLoggedIn: false, onekeyUserId: '' });
  await expect(retirePrimeWebCheckout('user-1')).rejects.toThrow(
    'user changed',
  );
});

it('continues the embedded payment when reading the record fails', async () => {
  mockRead.mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(retirePrimeWebCheckout('user-1')).resolves.toBeUndefined();
  expect(mockClear).not.toHaveBeenCalled();
});

it('continues the embedded payment when clearing the record fails', async () => {
  mockClear.mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(retirePrimeWebCheckout('user-1')).resolves.toBeUndefined();
  expect(mockUser).toHaveBeenCalledTimes(2);
});

it('still stops on an identity change after a failed read', async () => {
  mockRead.mockRejectedValueOnce(new Error('storage unavailable'));
  mockUser.mockResolvedValue({ isLoggedIn: true, onekeyUserId: 'user-2' });
  await expect(retirePrimeWebCheckout('user-1')).rejects.toThrow(
    'user changed',
  );
  expect(mockClear).not.toHaveBeenCalled();
});

it('still stops on an identity change after a failed clear', async () => {
  mockClear.mockRejectedValueOnce(new Error('storage unavailable'));
  mockUser.mockResolvedValueOnce({ isLoggedIn: true, onekeyUserId: 'user-1' });
  mockUser.mockResolvedValueOnce({ isLoggedIn: false, onekeyUserId: '' });
  await expect(retirePrimeWebCheckout('user-1')).rejects.toThrow(
    'user changed',
  );
});
