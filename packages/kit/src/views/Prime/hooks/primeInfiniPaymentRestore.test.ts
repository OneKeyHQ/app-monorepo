/* cspell:ignore Infini */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  buildPrimeInfiniPaymentCacheKey,
  getPrimeInfiniPaymentAssetKey,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import type {
  IPrimeInfiniPayment,
  IPrimeInfiniPaymentAsset,
  IPrimeInfiniPendingPaymentSession,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { resolvePrimeInfiniPaymentRestore } from './primeInfiniPaymentRestore';

const asset: IPrimeInfiniPaymentAsset = {
  key: getPrimeInfiniPaymentAssetKey({
    chain: 'ETHEREUM',
    token: 'USDC',
    networkId: 'evm--1',
    contractAddress: '0xa0b8',
  }),
  chain: 'ETHEREUM',
  token: 'USDC',
  networkId: 'evm--1',
  contractAddress: '0xa0b8',
};

const payment: IPrimeInfiniPayment = {
  paymentId: 'payment-1',
  address: '0xrecipient',
  chain: 'ETHEREUM',
  token: 'USDC',
  amountDue: '0.2',
  expiresAt: 1_800_000_000_000,
};

function buildSession({
  paymentOverride,
  sendStarted = false,
}: {
  paymentOverride?: Partial<IPrimeInfiniPayment>;
  sendStarted?: boolean;
} = {}): IPrimeInfiniPendingPaymentSession {
  const nextPayment = { ...payment, ...paymentOverride };
  const payerAccountId = 'account-1';
  const payerAddress = '0xpayer';
  return {
    schemaVersion: 2,
    asset,
    baseline: {
      onekeyUserId: 'user-1',
      wasPrimeActive: false,
    },
    plan: 'monthly',
    selectedSubscriptionPeriod: 'P1M',
    payerAccountId,
    payerAddress,
    paymentCacheKey: buildPrimeInfiniPaymentCacheKey({
      bindingId: 'binding-1',
      payment: nextPayment,
      asset,
      onekeyUserId: 'user-1',
      plan: 'monthly',
      payerAccountId,
      payerAddress,
    }),
    payment: nextPayment,
    sendStarted,
    updatedAt: 1_700_000_000_000,
  };
}

const baseParams = {
  supportedAssets: [asset],
  paymentOptionsLoaded: true,
  createNewPayment: false,
  requestedPlan: 'monthly' as const,
  requestedSubscriptionPeriod: 'P1M' as const,
  fetchPurchaseStatusSnapshot: async () => ({
    onekeyUserId: 'user-1',
    primeSubscription: undefined,
    infiniSubscription: undefined,
  }),
  clearCompletedPaymentSession: async () => undefined,
  persistRestoredSession: async (session: IPrimeInfiniPendingPaymentSession) =>
    session,
};

describe('resolvePrimeInfiniPaymentRestore', () => {
  it('discards an unsent cache when the server amount differs', async () => {
    const session = buildSession();
    const discardPaymentSession = jest.fn(async () => true);

    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        session,
        fetchLatestPayment: async () => ({
          ...payment,
          amountDue: '0.3',
        }),
        discardPaymentSession,
      }),
    ).resolves.toEqual({ type: 'discarded' });
    expect(discardPaymentSession).toHaveBeenCalledWith(
      buildSession().paymentCacheKey,
    );
  });

  it('never falls back to the cached amount when refresh fails', async () => {
    const discardPaymentSession = jest.fn(async () => true);

    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        session: buildSession(),
        fetchLatestPayment: async () => {
          throw new OneKeyLocalError('network unavailable');
        },
        discardPaymentSession,
      }),
    ).rejects.toThrow('network unavailable');
    expect(discardPaymentSession).not.toHaveBeenCalled();
  });

  it('does not expose a restored amount after fresh status proves activation', async () => {
    const fetchLatestPayment = jest.fn(async () => payment);
    const clearCompletedPaymentSession = jest.fn(async () => undefined);
    const persistRestoredSession = jest.fn(
      async (nextSession: IPrimeInfiniPendingPaymentSession) => nextSession,
    );

    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        session: buildSession(),
        fetchLatestPayment,
        fetchPurchaseStatusSnapshot: async () => ({
          onekeyUserId: 'user-1',
          primeSubscription: {
            isActive: true,
            expiresAt: 1_800_000_000_000,
          },
          infiniSubscription: undefined,
        }),
        clearCompletedPaymentSession,
        persistRestoredSession,
        discardPaymentSession: async () => true,
      }),
    ).resolves.toEqual({ type: 'completed' });
    expect(fetchLatestPayment).toHaveBeenCalledTimes(1);
    expect(clearCompletedPaymentSession).toHaveBeenCalledWith(
      buildSession().paymentCacheKey,
    );
    expect(persistRestoredSession).not.toHaveBeenCalled();
  });

  it('fails closed when the fresh purchase status cannot be verified', async () => {
    const persistRestoredSession = jest.fn(
      async (nextSession: IPrimeInfiniPendingPaymentSession) => nextSession,
    );

    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        session: buildSession(),
        fetchLatestPayment: async () => payment,
        fetchPurchaseStatusSnapshot: async () => {
          throw new OneKeyLocalError('purchase status unavailable');
        },
        persistRestoredSession,
        discardPaymentSession: async () => true,
      }),
    ).rejects.toThrow('purchase status unavailable');
    expect(persistRestoredSession).not.toHaveBeenCalled();
  });

  it('never restores an unsent cached asset when payment options fail to load', async () => {
    const discardPaymentSession = jest.fn(async () => true);

    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        session: buildSession(),
        supportedAssets: [],
        paymentOptionsLoaded: false,
        fetchLatestPayment: async () => payment,
        discardPaymentSession,
      }),
    ).rejects.toThrow('Infini payment options are unavailable during restore');
    expect(discardPaymentSession).not.toHaveBeenCalled();
  });

  it('keeps tracking a sent payment when payment options fail to load', async () => {
    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        session: buildSession({ sendStarted: true }),
        supportedAssets: [],
        paymentOptionsLoaded: false,
        fetchLatestPayment: async () => payment,
        discardPaymentSession: async () => true,
      }),
    ).resolves.toMatchObject({
      type: 'restore',
      asset,
      session: {
        sendStarted: true,
        payment,
      },
    });
  });

  it('never unlocks a cached payment after server progress temporarily regresses', async () => {
    const discardPaymentSession = jest.fn(async () => true);

    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        session: buildSession({
          paymentOverride: {
            amountConfirming: '0.01',
          },
        }),
        requestedPlan: 'yearly',
        requestedSubscriptionPeriod: 'P1Y',
        fetchLatestPayment: async () => ({
          ...payment,
          amountConfirming: '0',
        }),
        discardPaymentSession,
      }),
    ).resolves.toMatchObject({
      type: 'restore',
      session: {
        payment: {
          amountConfirming: '0.01',
        },
        sendStarted: true,
      },
    });
    expect(discardPaymentSession).not.toHaveBeenCalled();
  });

  it('commits newly observed progress before returning a restorable session', async () => {
    const persistRestoredSession = jest.fn(
      async (session: IPrimeInfiniPendingPaymentSession) => ({
        ...session,
        updatedAt: 1_700_000_000_001,
      }),
    );

    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        session: buildSession(),
        fetchLatestPayment: async () => ({
          ...payment,
          amountConfirming: '0.01',
        }),
        discardPaymentSession: async () => true,
        persistRestoredSession,
      }),
    ).resolves.toMatchObject({
      type: 'restore',
      session: {
        payment: {
          amountConfirming: '0.01',
        },
        sendStarted: true,
        updatedAt: 1_700_000_000_001,
      },
    });
    expect(persistRestoredSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sendStarted: true,
      }),
    );
  });

  it('restores an explicitly failed unsent cache until the user retries', async () => {
    const discardPaymentSession = jest.fn(async () => true);

    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        session: buildSession({
          paymentOverride: {
            status: 'failed',
          },
        }),
        fetchLatestPayment: async () => ({
          ...payment,
          status: 'pending',
        }),
        discardPaymentSession,
      }),
    ).resolves.toMatchObject({
      type: 'restore',
      session: {
        payment: {
          status: 'failed',
        },
      },
    });
    expect(discardPaymentSession).not.toHaveBeenCalled();
  });

  it('discards an unsent cache when the current asset contract changed', async () => {
    const replacementAsset = {
      ...asset,
      contractAddress: '0xdifferent',
    };
    replacementAsset.key = getPrimeInfiniPaymentAssetKey(replacementAsset);

    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        session: buildSession(),
        supportedAssets: [replacementAsset],
        fetchLatestPayment: async () => payment,
        discardPaymentSession: async () => true,
      }),
    ).resolves.toEqual({ type: 'discarded' });
  });

  it('discards an unsent cache when the selected plan changed', async () => {
    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        session: buildSession(),
        requestedPlan: 'yearly',
        requestedSubscriptionPeriod: 'P1Y',
        fetchLatestPayment: async () => payment,
        discardPaymentSession: async () => true,
      }),
    ).resolves.toEqual({ type: 'discarded' });
  });

  it('restores a valid unsent payment when the route does not request a new one', async () => {
    const latestPayment = {
      ...payment,
      status: 'pending',
      amountConfirming: '0',
    };
    const discardPaymentSession = jest.fn(async () => true);
    const session = buildSession();

    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        session,
        fetchLatestPayment: async () => latestPayment,
        discardPaymentSession,
      }),
    ).resolves.toMatchObject({
      type: 'restore',
      asset,
      session: {
        payment: latestPayment,
      },
    });
    expect(discardPaymentSession).not.toHaveBeenCalled();
  });

  it('discards a valid unsent payment for an explicit new crypto payment intent', async () => {
    const discardPaymentSession = jest.fn(async () => true);

    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        createNewPayment: true,
        session: buildSession(),
        fetchLatestPayment: async () => payment,
        discardPaymentSession,
      }),
    ).resolves.toEqual({ type: 'discarded' });
    expect(discardPaymentSession).toHaveBeenCalledWith(
      buildSession().paymentCacheKey,
    );
  });

  it('restores a near-expiry unsent payment until the user retries', async () => {
    const discardPaymentSession = jest.fn(async () => true);

    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        session: buildSession(),
        fetchLatestPayment: async () => payment,
        discardPaymentSession,
      }),
    ).resolves.toMatchObject({
      type: 'restore',
      session: {
        payment,
      },
    });
    expect(discardPaymentSession).not.toHaveBeenCalled();
  });

  it('keeps tracking server progress despite a new payment intent', async () => {
    const discardPaymentSession = jest.fn(async () => true);

    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        createNewPayment: true,
        session: buildSession(),
        fetchLatestPayment: async () => ({
          ...payment,
          amountConfirming: '0.01',
        }),
        discardPaymentSession,
      }),
    ).resolves.toMatchObject({
      type: 'restore',
      session: {
        payment: {
          amountConfirming: '0.01',
        },
        sendStarted: true,
      },
    });
    expect(discardPaymentSession).not.toHaveBeenCalled();
  });

  it('keeps tracking a locally started send despite a new payment intent', async () => {
    const discardPaymentSession = jest.fn(async () => true);

    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        createNewPayment: true,
        session: buildSession({ sendStarted: true }),
        fetchLatestPayment: async () => payment,
        discardPaymentSession,
      }),
    ).resolves.toMatchObject({
      type: 'restore',
      session: {
        sendStarted: true,
      },
    });
    expect(discardPaymentSession).not.toHaveBeenCalled();
  });

  it('fails closed when a sent payment has different transfer terms', async () => {
    await expect(
      resolvePrimeInfiniPaymentRestore({
        ...baseParams,
        session: buildSession({ sendStarted: true }),
        fetchLatestPayment: async () => ({
          ...payment,
          address: '0xdifferent-recipient',
        }),
        discardPaymentSession: async () => true,
      }),
    ).rejects.toThrow('transfer snapshot changed');
  });
});
