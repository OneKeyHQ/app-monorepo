/* cspell:ignore Infini */
import { getPrimeInfiniExternalCheckoutGuard } from './primeInfiniExternalCheckoutGuard';

const mockGetLocalUserInfo = jest.fn<
  Promise<{ isLoggedIn: boolean; onekeyUserId?: string }>,
  []
>();
const mockGetPendingPaymentSession = jest.fn<
  Promise<unknown>,
  [{ onekeyUserId: string }]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      getLocalUserInfo: () => mockGetLocalUserInfo(),
    },
    simpleDb: {
      prime: {
        getInfiniPendingPaymentSession: (params: { onekeyUserId: string }) =>
          mockGetPendingPaymentSession(params),
      },
    },
  },
}));

describe('getPrimeInfiniExternalCheckoutGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks external checkout when another context has persisted a payment', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      payment: { paymentId: 'payment-1' },
    });

    await expect(getPrimeInfiniExternalCheckoutGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
    });
    expect(mockGetPendingPaymentSession).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
    });
  });

  it('does not read a user-scoped session after logout', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: false,
      onekeyUserId: undefined,
    });

    await expect(getPrimeInfiniExternalCheckoutGuard()).resolves.toEqual({
      isLoggedIn: false,
      hasPendingPayment: false,
      onekeyUserId: undefined,
    });
    expect(mockGetPendingPaymentSession).not.toHaveBeenCalled();
  });
});
