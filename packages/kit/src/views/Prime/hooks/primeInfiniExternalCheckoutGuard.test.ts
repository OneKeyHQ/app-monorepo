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
const mockApiGetInfiniPurchaseStatusSnapshot = jest.fn<
  Promise<unknown>,
  [{ expectedOneKeyUserId: string }]
>();
const mockClearPendingPaymentSession = jest.fn<
  Promise<boolean>,
  [
    {
      onekeyUserId: string;
      expectedPaymentCacheIdentity: { paymentId: string };
    },
  ]
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
      apiGetInfiniPurchaseStatusSnapshot: (params: {
        expectedOneKeyUserId: string;
      }) => mockApiGetInfiniPurchaseStatusSnapshot(params),
    },
    simpleDb: {
      prime: {
        getInfiniPendingPaymentSession: async (params: {
          onekeyUserId: string;
        }) => {
          const session = await mockGetPendingPaymentSession(params);
          return session && typeof session === 'object'
            ? {
                baseline: {
                  onekeyUserId: params.onekeyUserId,
                  wasPrimeActive: false,
                },
                ...session,
              }
            : session;
        },
        clearInfiniPendingPaymentSession: (params: {
          onekeyUserId: string;
          expectedPaymentCacheIdentity: { paymentId: string };
        }) => mockClearPendingPaymentSession(params),
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
    mockClearPendingPaymentSession.mockResolvedValue(true);
    mockApiGetInfiniPurchaseStatusSnapshot.mockResolvedValue({
      onekeyUserId: 'user-1',
      primeSubscription: undefined,
      infiniSubscription: undefined,
    });
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

  it('releases a completed payment before external checkout', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      sendStarted: true,
      paymentCacheKey: { paymentId: 'payment-1' },
      payment: { paymentId: 'payment-1' },
    });
    mockApiGetInfiniPurchaseStatusSnapshot.mockResolvedValue({
      onekeyUserId: 'user-1',
      primeSubscription: {
        isActive: true,
        expiresAt: 1_800_000_000_000,
        subscriptions: [{ channel: 'infini' }],
      },
      infiniSubscription: undefined,
    });

    await expect(getPrimeInfiniExternalCheckoutGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: false,
      onekeyUserId: 'user-1',
    });
    expect(mockClearPendingPaymentSession).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      expectedPaymentCacheIdentity: { paymentId: 'payment-1' },
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

  it('releases a completed Infini purchase instead of reporting it as pending', async () => {
    mockGetLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-1',
    });
    mockGetPendingPaymentSession.mockResolvedValue({
      baseline: {
        onekeyUserId: 'user-1',
        wasPrimeActive: false,
      },
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
      amountConfirmed: '1',
      amountConfirming: '0',
    });
    mockApiGetInfiniPurchaseStatusSnapshot.mockResolvedValue({
      onekeyUserId: 'user-1',
      primeSubscription: {
        isActive: true,
        expiresAt: 1_800_000_000_000,
        subscriptions: [{ channel: 'infini' }],
      },
      infiniSubscription: {
        subscriptionId: 'subscription-1',
        status: 'active',
        plan: 'monthly',
      },
    });

    await expect(getPrimeInfiniPaymentEntryGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: false,
      onekeyUserId: 'user-1',
      pendingSubscriptionPeriod: undefined,
    });
    expect(mockClearPendingPaymentSession).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      expectedPaymentCacheIdentity: { paymentId: 'payment-1' },
    });
    expect(mockLatchPendingPaymentProgress).not.toHaveBeenCalled();
  });

  it('keeps a payment pending when its purchase status cannot be refreshed', async () => {
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
      amountConfirmed: '1',
      amountConfirming: '0',
    });
    const error = new Error('purchase status endpoint down');
    mockApiGetInfiniPurchaseStatusSnapshot.mockRejectedValue(error);

    await expect(getPrimeInfiniPaymentEntryGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
      pendingSubscriptionPeriod: 'P1M',
    });
    expect(mockClearPendingPaymentSession).not.toHaveBeenCalled();
    expect(mockLogPrimeInfiniPaymentFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'entryGuardPurchaseStatusRefreshFailed',
        error,
      }),
    );
  });

  it('fails closed when a completed payment session is replaced before clearing', async () => {
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
      amountConfirmed: '1',
      amountConfirming: '0',
    });
    mockApiGetInfiniPurchaseStatusSnapshot.mockResolvedValue({
      onekeyUserId: 'user-1',
      primeSubscription: {
        isActive: true,
        expiresAt: 1_800_000_000_000,
        subscriptions: [{ channel: 'infini' }],
      },
      infiniSubscription: undefined,
    });
    mockClearPendingPaymentSession.mockResolvedValue(false);

    await expect(getPrimeInfiniPaymentEntryGuard()).rejects.toThrow(
      'Infini payment session changed while it was being verified',
    );
  });

  it('latches server progress before blocking the payment method picker', async () => {
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

    await expect(getPrimeInfiniPaymentEntryGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
      pendingSubscriptionPeriod: 'P1M',
    });
    expect(mockLatchPendingPaymentProgress).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      paymentCacheKey: { paymentId: 'payment-1' },
      latestPayment,
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
      pendingSubscriptionPeriod: undefined,
    });
    expect(mockDiscardUnsentPaymentSession).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      expectedPaymentCacheIdentity: { paymentId: 'payment-1' },
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

  it('keeps a claimed session pending when the invoice fetch fails and the purchase is incomplete', async () => {
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

    await expect(getPrimeInfiniPaymentEntryGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: true,
      onekeyUserId: 'user-1',
      pendingSubscriptionPeriod: 'P1M',
    });
    expect(mockDiscardTerminalPaymentSession).not.toHaveBeenCalled();
    expect(mockLatchPendingPaymentProgress).not.toHaveBeenCalled();
    expect(mockDiscardUnsentPaymentSession).not.toHaveBeenCalled();
    expect(mockApiGetInfiniPurchaseStatusSnapshot).toHaveBeenCalledWith({
      expectedOneKeyUserId: 'user-1',
    });
    expect(mockLogPrimeInfiniPaymentFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'entryGuardPaymentRefreshFailed',
        error,
      }),
    );
  });

  it('releases a completed purchase when the invoice fetch fails', async () => {
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
    mockApiGetInfiniPayment.mockRejectedValue(
      new Error('invoice endpoint down'),
    );
    mockApiGetInfiniPurchaseStatusSnapshot.mockResolvedValue({
      onekeyUserId: 'user-1',
      primeSubscription: {
        isActive: true,
        expiresAt: 1_800_000_000_000,
        subscriptions: [{ channel: 'infini' }],
      },
      infiniSubscription: undefined,
    });

    await expect(getPrimeInfiniPaymentEntryGuard()).resolves.toEqual({
      isLoggedIn: true,
      hasPendingPayment: false,
      onekeyUserId: 'user-1',
      pendingSubscriptionPeriod: undefined,
    });
    expect(mockClearPendingPaymentSession).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      expectedPaymentCacheIdentity: { paymentId: 'payment-1' },
    });
    expect(mockDiscardUnsentPaymentSession).not.toHaveBeenCalled();
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
      pendingSubscriptionPeriod: undefined,
    });
    expect(mockDiscardUnsentPaymentSession).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      expectedPaymentCacheIdentity: { paymentId: 'payment-1' },
    });
  });

  it('fails closed when the replaceable snapshot changes during the outage', async () => {
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

    await expect(getPrimeInfiniPaymentEntryGuard()).rejects.toThrow(
      'Infini payment session changed while it was being verified',
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
