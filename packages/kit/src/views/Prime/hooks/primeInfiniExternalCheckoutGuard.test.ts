/* cspell:ignore Infini */
import {
  getPrimeInfiniExternalCheckoutGuard,
  getPrimeInfiniPaymentEntryGuard,
} from './primeInfiniExternalCheckoutGuard';

const mockGetLocalUserInfo = jest.fn<
  Promise<{ isLoggedIn: boolean; onekeyUserId?: string }>,
  []
>();
const mockGetPendingPaymentSession = jest.fn<
  Promise<unknown>,
  [{ onekeyUserId: string }]
>();
const mockApiGetInfiniPayment = jest.fn<
  Promise<unknown>,
  [{ paymentId: string; expectedOneKeyUserId: string }]
>();
const mockLatchPendingPaymentProgress = jest.fn<
  Promise<unknown>,
  [
    {
      onekeyUserId: string;
      paymentCacheKey: { paymentId: string };
      latestPayment: unknown;
    },
  ]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      getLocalUserInfo: () => mockGetLocalUserInfo(),
      apiGetInfiniPayment: (params: {
        paymentId: string;
        expectedOneKeyUserId: string;
      }) => mockApiGetInfiniPayment(params),
    },
    simpleDb: {
      prime: {
        getInfiniPendingPaymentSession: (params: { onekeyUserId: string }) =>
          mockGetPendingPaymentSession(params),
        latchInfiniPendingPaymentSessionProgress: (params: {
          onekeyUserId: string;
          paymentCacheKey: { paymentId: string };
          latestPayment: unknown;
        }) => mockLatchPendingPaymentProgress(params),
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

  it('blocks the payment method picker after a send has started', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: true,
      paymentCacheKey: {
        paymentId: 'payment-1',
      },
      payment: {
        paymentId: 'payment-1',
        amountDue: '1',
        amountConfirmed: '0',
        amountConfirming: '0',
      },
    });
    mockApiGetInfiniPayment.mockResolvedValue({
      paymentId: 'payment-1',
      amountDue: '1',
      amountConfirmed: '0',
      amountConfirming: '0',
    });

    await expect(getPrimeInfiniPaymentEntryGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
    });
  });

  it('latches the observed server progress before blocking', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: false,
      paymentCacheKey: {
        paymentId: 'payment-1',
      },
      payment: {
        paymentId: 'payment-1',
        amountDue: '1',
        amountConfirmed: '0',
        amountConfirming: '0',
      },
    });
    const latestPayment = {
      paymentId: 'payment-1',
      amountDue: '1',
      amountConfirmed: '0',
      amountConfirming: '0.5',
    };
    mockApiGetInfiniPayment.mockResolvedValue(latestPayment);

    await getPrimeInfiniPaymentEntryGuard();

    expect(mockLatchPendingPaymentProgress).toHaveBeenCalledTimes(1);
    expect(mockLatchPendingPaymentProgress).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      paymentCacheKey: { paymentId: 'payment-1' },
      latestPayment,
    });
  });

  it('blocks the payment method picker when the server reports payment progress', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: false,
      paymentCacheKey: {
        paymentId: 'payment-1',
      },
      payment: {
        paymentId: 'payment-1',
        amountDue: '1',
        amountConfirmed: '0',
        amountConfirming: '0',
      },
    });
    mockApiGetInfiniPayment.mockResolvedValue({
      paymentId: 'payment-1',
      amountDue: '1',
      amountConfirmed: '0',
      amountConfirming: '0.5',
    });

    await expect(getPrimeInfiniPaymentEntryGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
    });
  });

  it('allows the payment method picker for an unsent replaceable invoice', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: false,
      paymentCacheKey: {
        paymentId: 'payment-1',
      },
      payment: {
        paymentId: 'payment-1',
        amountDue: '1',
        amountConfirmed: '0',
        amountConfirming: '0',
      },
    });
    mockApiGetInfiniPayment.mockResolvedValue({
      paymentId: 'payment-1',
      amountDue: '1',
      amountConfirmed: '0',
      amountConfirming: '0',
    });

    await expect(getPrimeInfiniPaymentEntryGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: false,
      onekeyUserId: 'user-1',
    });
    expect(mockLatchPendingPaymentProgress).not.toHaveBeenCalled();
  });
});
