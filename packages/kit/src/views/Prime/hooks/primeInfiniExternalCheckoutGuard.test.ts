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
const mockDiscardTerminalPaymentSession = jest.fn<
  Promise<boolean>,
  [
    {
      onekeyUserId: string;
      expectedPaymentCacheIdentity: { paymentId: string };
      expectedUpdatedAt: number;
      expectedSendStarted: boolean;
      latestPayment: unknown;
    },
  ]
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
const mockDiscardUnsentPaymentSession = jest.fn<
  Promise<boolean>,
  [
    {
      onekeyUserId: string;
      expectedPaymentCacheIdentity: { paymentId: string };
    },
  ]
>();
const mockLogPrimeInfiniPaymentFlow = jest.fn();

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
        discardTerminalInfiniPendingPaymentSession: (params: {
          onekeyUserId: string;
          expectedPaymentCacheIdentity: { paymentId: string };
          expectedUpdatedAt: number;
          expectedSendStarted: boolean;
          latestPayment: unknown;
        }) => mockDiscardTerminalPaymentSession(params),
        latchInfiniPendingPaymentSessionProgress: (params: {
          onekeyUserId: string;
          paymentCacheKey: { paymentId: string };
          latestPayment: unknown;
        }) => mockLatchPendingPaymentProgress(params),
        discardUnsentInfiniPendingPaymentSession: (params: {
          onekeyUserId: string;
          expectedPaymentCacheIdentity: { paymentId: string };
        }) => mockDiscardUnsentPaymentSession(params),
      },
    },
  },
}));

jest.mock('../primeInfiniPaymentLogger', () => ({
  logPrimeInfiniPaymentFlow: (...args: unknown[]) => {
    mockLogPrimeInfiniPaymentFlow(...args);
  },
}));

describe('getPrimeInfiniExternalCheckoutGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLatchPendingPaymentProgress.mockResolvedValue({ sendStarted: true });
    mockDiscardTerminalPaymentSession.mockResolvedValue(true);
    mockDiscardUnsentPaymentSession.mockResolvedValue(true);
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
      selectedSubscriptionPeriod: 'P1M',
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
      pendingSubscriptionPeriod: 'P1M',
    });
  });

  it('latches the observed server progress before blocking', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: false,
      selectedSubscriptionPeriod: 'P1M',
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
      selectedSubscriptionPeriod: 'P1M',
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
      pendingSubscriptionPeriod: 'P1M',
    });
  });

  it('allows the payment method picker for an unsent replaceable invoice', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: false,
      selectedSubscriptionPeriod: 'P1M',
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
      pendingSubscriptionPeriod: 'P1M',
    });
    expect(mockLatchPendingPaymentProgress).not.toHaveBeenCalled();
  });

  it('releases a claimed session once the server closes the invoice unpaid', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: true,
      selectedSubscriptionPeriod: 'P1M',
      updatedAt: 1000,
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
      amountConfirming: '0',
      status: 'expired',
    };
    mockApiGetInfiniPayment.mockResolvedValue(latestPayment);

    await expect(getPrimeInfiniPaymentEntryGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: false,
      onekeyUserId: 'user-1',
      pendingSubscriptionPeriod: undefined,
    });
    expect(mockDiscardTerminalPaymentSession).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      expectedPaymentCacheIdentity: { paymentId: 'payment-1' },
      expectedUpdatedAt: 1000,
      expectedSendStarted: true,
      latestPayment,
    });
    expect(mockLatchPendingPaymentProgress).not.toHaveBeenCalled();
  });

  it('keeps blocking a claimed session that only expired on the local clock', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: true,
      selectedSubscriptionPeriod: 'P1Y',
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
      expiresAt: 1,
    });

    await expect(getPrimeInfiniPaymentEntryGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
      pendingSubscriptionPeriod: 'P1Y',
    });
    expect(mockDiscardTerminalPaymentSession).not.toHaveBeenCalled();
  });

  it('degrades to the local snapshot when the invoice fetch fails on a claimed session', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: true,
      selectedSubscriptionPeriod: 'P1M',
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
    const error = new Error('invoice endpoint down');
    mockApiGetInfiniPayment.mockRejectedValue(error);

    // Blocking every channel here would strand the user until the session
    // TTL; reporting the pending payment instead routes them into the crypto
    // flow, whose stale fallback screen can still force a replacement.
    await expect(getPrimeInfiniPaymentEntryGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
      pendingSubscriptionPeriod: 'P1M',
    });
    expect(mockDiscardTerminalPaymentSession).not.toHaveBeenCalled();
    expect(mockLatchPendingPaymentProgress).not.toHaveBeenCalled();
    expect(mockDiscardUnsentPaymentSession).not.toHaveBeenCalled();
    expect(mockLogPrimeInfiniPaymentFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'entryGuardPaymentRefreshFailed',
        error,
      }),
    );
  });

  it('keeps the picker open when the invoice fetch fails on a replaceable session', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: false,
      selectedSubscriptionPeriod: 'P1M',
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
    mockApiGetInfiniPayment.mockRejectedValue(
      new Error('invoice endpoint down'),
    );

    // A stale snapshot alone must not open a second channel: only the atomic
    // retire proves no other window claimed the broadcast during the fetch.
    await expect(getPrimeInfiniPaymentEntryGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: false,
      onekeyUserId: 'user-1',
      pendingSubscriptionPeriod: 'P1M',
    });
    expect(mockDiscardUnsentPaymentSession).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      expectedPaymentCacheIdentity: { paymentId: 'payment-1' },
    });
  });

  it('keeps blocking when the replaceable snapshot cannot be retired during the outage', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: false,
      selectedSubscriptionPeriod: 'P1M',
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
    mockApiGetInfiniPayment.mockRejectedValue(
      new Error('invoice endpoint down'),
    );
    // Another window latched sendStarted while the fetch was in flight, so the
    // atomic discard refuses; the picker must stay closed because that other
    // window's broadcast is already authorized.
    mockDiscardUnsentPaymentSession.mockResolvedValue(false);

    await expect(getPrimeInfiniPaymentEntryGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
      pendingSubscriptionPeriod: 'P1M',
    });
  });

  it('logs a failed atomic retirement while keeping the payment blocked', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: false,
      selectedSubscriptionPeriod: 'P1M',
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
    mockApiGetInfiniPayment.mockRejectedValue(
      new Error('invoice endpoint down'),
    );
    const discardError = new Error('storage unavailable');
    mockDiscardUnsentPaymentSession.mockRejectedValue(discardError);

    await expect(getPrimeInfiniPaymentEntryGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
      pendingSubscriptionPeriod: 'P1M',
    });
    expect(mockLogPrimeInfiniPaymentFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'entryGuardSessionRetirementFailed',
        error: discardError,
      }),
    );
  });

  it('fails closed when the session is replaced while the payment is fetched', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: false,
      selectedSubscriptionPeriod: 'P1M',
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
    // Another window swapped the stored session, so no matching session takes
    // the latch and the observed progress is recorded nowhere.
    mockLatchPendingPaymentProgress.mockResolvedValue(undefined);

    await expect(getPrimeInfiniPaymentEntryGuard()).rejects.toThrow(
      'Infini payment session changed while it was being verified',
    );
  });

  it('fails closed when a terminal session cannot be discarded', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: true,
      selectedSubscriptionPeriod: 'P1M',
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
      status: 'expired',
    });
    mockDiscardTerminalPaymentSession.mockResolvedValue(false);

    await expect(getPrimeInfiniPaymentEntryGuard()).rejects.toThrow(
      'Infini payment session changed while it was being verified',
    );
  });
});
