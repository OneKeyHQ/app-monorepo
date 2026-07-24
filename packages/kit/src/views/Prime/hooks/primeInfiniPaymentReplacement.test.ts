/* cspell:ignore Infini */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  buildPrimeInfiniPaymentCacheKey,
  getPrimeInfiniPaymentAssetKey,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import type { IPrimeInfiniPayment } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  addPrimeInfiniDiscardedPaymentBindingId,
  getPrimeInfiniAccountSelectionIdentity,
  getPrimeInfiniConfirmedAccountSelectionOutcome,
  resolvePrimeInfiniPaymentAccountRebind,
  resolvePrimeInfiniPaymentForcedReplacement,
  resolvePrimeInfiniPaymentReplacement,
  shouldRebindPrimeInfiniPaymentForAccount,
} from './primeInfiniPaymentReplacement';

const asset = {
  key: getPrimeInfiniPaymentAssetKey({
    chain: 'SOLANA',
    token: 'USDC',
    networkId: 'sol--101',
    contractAddress: 'usdc-contract',
  }),
  chain: 'SOLANA',
  token: 'USDC',
  networkId: 'sol--101',
  contractAddress: 'usdc-contract',
};

const payment: IPrimeInfiniPayment = {
  paymentId: 'payment-1',
  address: 'payment-address',
  chain: 'SOLANA',
  token: 'USDC',
  amountDue: '0.2',
  expiresAt: Date.now() + 60_000,
  amountConfirmed: '0',
  amountConfirming: '0',
};

function buildPersistedSession({
  nextPayment = payment,
  sendStarted,
}: {
  nextPayment?: typeof payment;
  sendStarted: boolean;
}) {
  const payerAccountId = 'account-1';
  const payerAddress = 'payer-address';
  return {
    schemaVersion: 2 as const,
    updatedAt: Date.now(),
    asset,
    baseline: {
      onekeyUserId: 'user-1',
      wasPrimeActive: false,
    },
    plan: 'monthly' as const,
    selectedSubscriptionPeriod: 'P1M' as const,
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
  };
}

async function persistTrackedPayment(nextPayment: typeof payment) {
  return buildPersistedSession({
    nextPayment,
    sendStarted: true,
  });
}

describe('addPrimeInfiniDiscardedPaymentBindingId', () => {
  it('keeps every discarded local binding hidden across replacements', () => {
    const afterFirstReplacement = addPrimeInfiniDiscardedPaymentBindingId(
      new Set(),
      'binding-1',
    );
    const afterSecondReplacement = addPrimeInfiniDiscardedPaymentBindingId(
      afterFirstReplacement,
      'binding-2',
    );

    expect([...afterSecondReplacement]).toEqual(['binding-1', 'binding-2']);
    expect(
      addPrimeInfiniDiscardedPaymentBindingId(
        afterSecondReplacement,
        'binding-2',
      ),
    ).toBe(afterSecondReplacement);
  });

  it('does not hide a new binding when the server reuses a payment ID', () => {
    const discardedBindings = addPrimeInfiniDiscardedPaymentBindingId(
      new Set(),
      'binding-1',
    );

    expect(discardedBindings.has('binding-1')).toBe(true);
    expect(discardedBindings.has('binding-2')).toBe(false);
  });
});

describe('resolvePrimeInfiniPaymentReplacement', () => {
  it('queries and atomically discards an unsent payment before replacement', async () => {
    const calls: string[] = [];
    const fetchLatestPayment = jest.fn(async () => {
      calls.push('query');
      return payment;
    });
    const discardPaymentSession = jest.fn(async () => {
      calls.push('discard');
      return true;
    });
    const fetchPersistedPaymentSession = jest.fn();

    await expect(
      resolvePrimeInfiniPaymentReplacement({
        currentPayment: payment,
        selectedAsset: asset,
        sendStarted: false,
        fetchLatestPayment,
        discardPaymentSession,
        fetchPersistedPaymentSession,
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).resolves.toEqual({
      type: 'replace',
      payment,
    });
    expect(calls).toEqual(['query', 'discard']);
    expect(fetchPersistedPaymentSession).not.toHaveBeenCalled();
  });

  it('tracks a freshly observed payment progress without discarding it', async () => {
    const progressedPayment = {
      ...payment,
      amountConfirming: '0.01',
    };
    const discardPaymentSession = jest.fn();

    await expect(
      resolvePrimeInfiniPaymentReplacement({
        currentPayment: payment,
        selectedAsset: asset,
        sendStarted: false,
        fetchLatestPayment: async () => progressedPayment,
        discardPaymentSession,
        fetchPersistedPaymentSession: jest.fn(),
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).resolves.toEqual({
      type: 'track',
      payment: progressedPayment,
    });
    expect(discardPaymentSession).not.toHaveBeenCalled();
  });

  it('fails closed when newly observed progress cannot be persisted', async () => {
    const discardPaymentSession = jest.fn();
    const persistError = new OneKeyLocalError('persist failed');

    await expect(
      resolvePrimeInfiniPaymentReplacement({
        currentPayment: payment,
        selectedAsset: asset,
        sendStarted: false,
        fetchLatestPayment: async () => ({
          ...payment,
          amountConfirming: '0.01',
        }),
        discardPaymentSession,
        fetchPersistedPaymentSession: jest.fn(),
        persistTrackedPayment: async () => {
          throw persistError;
        },
        shouldContinue: () => true,
      }),
    ).rejects.toBe(persistError);
    expect(discardPaymentSession).not.toHaveBeenCalled();
  });

  it('never replaces after previously observed progress temporarily regresses', async () => {
    const progressedPayment = {
      ...payment,
      amountConfirming: '0.01',
    };
    const discardPaymentSession = jest.fn();

    await expect(
      resolvePrimeInfiniPaymentReplacement({
        currentPayment: progressedPayment,
        selectedAsset: asset,
        sendStarted: false,
        fetchLatestPayment: async () => payment,
        discardPaymentSession,
        fetchPersistedPaymentSession: jest.fn(),
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).resolves.toEqual({
      type: 'track',
      payment: progressedPayment,
    });
    expect(discardPaymentSession).not.toHaveBeenCalled();
  });

  it('tracks an already-sent terminal payment instead of discarding it', async () => {
    const expiredPayment = {
      ...payment,
      expiresAt: Date.now() - 1,
      status: 'expired',
    };
    const discardPaymentSession = jest.fn();

    await expect(
      resolvePrimeInfiniPaymentReplacement({
        currentPayment: expiredPayment,
        selectedAsset: asset,
        sendStarted: true,
        fetchLatestPayment: async () => expiredPayment,
        discardPaymentSession,
        fetchPersistedPaymentSession: jest.fn(),
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).resolves.toEqual({
      type: 'track',
      payment: expiredPayment,
    });
    expect(discardPaymentSession).not.toHaveBeenCalled();
  });

  it('tracks a payment that won the atomic send-started race', async () => {
    const persistedSession = buildPersistedSession({
      sendStarted: true,
    });

    await expect(
      resolvePrimeInfiniPaymentReplacement({
        currentPayment: payment,
        selectedAsset: asset,
        sendStarted: false,
        fetchLatestPayment: async () => payment,
        discardPaymentSession: async () => false,
        fetchPersistedPaymentSession: async () => persistedSession,
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).resolves.toEqual({
      type: 'track',
      payment,
    });
  });

  it('reloads when another payment session replaced the current one', async () => {
    const persistedSession = buildPersistedSession({
      nextPayment: {
        ...payment,
        paymentId: 'payment-2',
      },
      sendStarted: false,
    });

    await expect(
      resolvePrimeInfiniPaymentReplacement({
        currentPayment: payment,
        selectedAsset: asset,
        sendStarted: false,
        fetchLatestPayment: async () => payment,
        discardPaymentSession: async () => false,
        fetchPersistedPaymentSession: async () => persistedSession,
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).resolves.toEqual({ type: 'reload' });
  });

  it('does not discard after a failed payment refresh', async () => {
    const refreshError = new OneKeyLocalError('refresh failed');
    const discardPaymentSession = jest.fn();

    await expect(
      resolvePrimeInfiniPaymentReplacement({
        currentPayment: payment,
        selectedAsset: asset,
        sendStarted: false,
        fetchLatestPayment: async () => {
          throw refreshError;
        },
        discardPaymentSession,
        fetchPersistedPaymentSession: jest.fn(),
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).rejects.toBe(refreshError);
    expect(discardPaymentSession).not.toHaveBeenCalled();
  });

  it('does not replace after a failed atomic discard', async () => {
    const discardError = new OneKeyLocalError('discard failed');

    await expect(
      resolvePrimeInfiniPaymentReplacement({
        currentPayment: payment,
        selectedAsset: asset,
        sendStarted: false,
        fetchLatestPayment: async () => payment,
        discardPaymentSession: async () => {
          throw discardError;
        },
        fetchPersistedPaymentSession: jest.fn(),
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).rejects.toBe(discardError);
  });

  it('does not discard after the owning UI attempt becomes stale', async () => {
    const discardPaymentSession = jest.fn();

    await expect(
      resolvePrimeInfiniPaymentReplacement({
        currentPayment: payment,
        selectedAsset: asset,
        sendStarted: false,
        fetchLatestPayment: async () => payment,
        discardPaymentSession,
        fetchPersistedPaymentSession: jest.fn(),
        persistTrackedPayment,
        shouldContinue: () => false,
      }),
    ).resolves.toEqual({ type: 'cancelled' });
    expect(discardPaymentSession).not.toHaveBeenCalled();
  });

  it('does not act on a persisted-session race after ownership becomes stale', async () => {
    let ownsAttempt = true;

    await expect(
      resolvePrimeInfiniPaymentReplacement({
        currentPayment: payment,
        selectedAsset: asset,
        sendStarted: false,
        fetchLatestPayment: async () => payment,
        discardPaymentSession: async () => false,
        fetchPersistedPaymentSession: async () => {
          ownsAttempt = false;
          return buildPersistedSession({
            sendStarted: true,
          });
        },
        persistTrackedPayment,
        shouldContinue: () => ownsAttempt,
      }),
    ).resolves.toEqual({ type: 'cancelled' });
  });
});

describe('resolvePrimeInfiniPaymentAccountRebind', () => {
  it('keeps the payment ID while atomically rebinding an unpaid invoice', async () => {
    const reboundSession = {
      ...buildPersistedSession({ sendStarted: false }),
      payerAccountId: 'account-2',
      payerAddress: 'payer-address-2',
    };
    const rebindPaymentSession = jest.fn(async () => reboundSession);

    await expect(
      resolvePrimeInfiniPaymentAccountRebind({
        currentPayment: payment,
        selectedAsset: asset,
        sendStarted: false,
        fetchLatestPayment: async () => payment,
        rebindPaymentSession,
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).resolves.toEqual({
      type: 'rebind',
      session: reboundSession,
    });
    expect(rebindPaymentSession).toHaveBeenCalledWith(payment);
  });

  it('tracks fresh server progress instead of rebinding the payer', async () => {
    const progressedPayment = {
      ...payment,
      amountConfirming: '0.01',
    };
    const rebindPaymentSession = jest.fn();

    await expect(
      resolvePrimeInfiniPaymentAccountRebind({
        currentPayment: payment,
        selectedAsset: asset,
        sendStarted: false,
        fetchLatestPayment: async () => progressedPayment,
        rebindPaymentSession,
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).resolves.toEqual({
      type: 'track',
      payment: progressedPayment,
    });
    expect(rebindPaymentSession).not.toHaveBeenCalled();
  });

  it('reloads after an atomic payer rebind race', async () => {
    await expect(
      resolvePrimeInfiniPaymentAccountRebind({
        currentPayment: payment,
        selectedAsset: asset,
        sendStarted: false,
        fetchLatestPayment: async () => payment,
        rebindPaymentSession: async () => undefined,
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).resolves.toEqual({ type: 'reload' });
  });

  it('does not rebind after the owning UI attempt becomes stale', async () => {
    const rebindPaymentSession = jest.fn();

    await expect(
      resolvePrimeInfiniPaymentAccountRebind({
        currentPayment: payment,
        selectedAsset: asset,
        sendStarted: false,
        fetchLatestPayment: async () => payment,
        rebindPaymentSession,
        persistTrackedPayment,
        shouldContinue: () => false,
      }),
    ).resolves.toEqual({ type: 'cancelled' });
    expect(rebindPaymentSession).not.toHaveBeenCalled();
  });
});

describe('resolvePrimeInfiniPaymentForcedReplacement', () => {
  const currentSession = buildPersistedSession({
    nextPayment: {
      ...payment,
      amountConfirmed: '0.1',
    },
    sendStarted: true,
  });
  const fetchPurchaseStatusSnapshot = async () => ({
    onekeyUserId: 'user-1',
    primeSubscription: undefined,
    infiniSubscription: undefined,
  });

  it('archives a partially paid invoice before creating a new one', async () => {
    const archivePaymentSession = jest.fn(async (latestPayment) => ({
      ...currentSession,
      payment: latestPayment,
    }));

    await expect(
      resolvePrimeInfiniPaymentForcedReplacement({
        currentSession,
        fetchLatestPayment: async () => currentSession.payment,
        fetchPurchaseStatusSnapshot,
        archivePaymentSession,
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).resolves.toEqual({
      type: 'replace',
      payment: currentSession.payment,
    });
    expect(archivePaymentSession).toHaveBeenCalledWith(currentSession.payment);
  });

  it('does not replace an invoice after it becomes fully paid', async () => {
    const fullyPaidPayment = {
      ...currentSession.payment,
      amountConfirmed: currentSession.payment.amountDue,
    };
    const archivePaymentSession = jest.fn();

    await expect(
      resolvePrimeInfiniPaymentForcedReplacement({
        currentSession,
        fetchLatestPayment: async () => fullyPaidPayment,
        fetchPurchaseStatusSnapshot,
        archivePaymentSession,
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).resolves.toEqual({
      type: 'track',
      payment: fullyPaidPayment,
    });
    expect(archivePaymentSession).not.toHaveBeenCalled();
  });

  it('does not replace after the subscription became active', async () => {
    const archivePaymentSession = jest.fn();

    await expect(
      resolvePrimeInfiniPaymentForcedReplacement({
        currentSession,
        fetchLatestPayment: async () => currentSession.payment,
        fetchPurchaseStatusSnapshot: async () => ({
          onekeyUserId: 'user-1',
          primeSubscription: {
            isActive: true,
            expiresAt: Date.now() + 60_000,
          },
          infiniSubscription: undefined,
        }),
        archivePaymentSession,
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).resolves.toEqual({ type: 'completed' });
    expect(archivePaymentSession).not.toHaveBeenCalled();
  });

  it('reloads when the active session changed during archival', async () => {
    await expect(
      resolvePrimeInfiniPaymentForcedReplacement({
        currentSession,
        fetchLatestPayment: async () => currentSession.payment,
        fetchPurchaseStatusSnapshot,
        archivePaymentSession: async () => undefined,
        persistTrackedPayment,
        shouldContinue: () => true,
      }),
    ).resolves.toEqual({ type: 'reload' });
  });

  it('does not archive after the owning UI attempt becomes stale', async () => {
    const archivePaymentSession = jest.fn();

    await expect(
      resolvePrimeInfiniPaymentForcedReplacement({
        currentSession,
        fetchLatestPayment: async () => currentSession.payment,
        fetchPurchaseStatusSnapshot,
        archivePaymentSession,
        persistTrackedPayment,
        shouldContinue: () => false,
      }),
    ).resolves.toEqual({ type: 'cancelled' });
    expect(archivePaymentSession).not.toHaveBeenCalled();
  });
});

describe('getPrimeInfiniAccountSelectionIdentity', () => {
  it('uses indexed account identity before an others-wallet account', () => {
    expect(
      getPrimeInfiniAccountSelectionIdentity({
        indexedAccountId: 'indexed-1',
        othersWalletAccountId: 'others-1',
        deriveType: 'default',
      }),
    ).toBe('indexed:indexed-1:default');
  });

  it('uses an others-wallet account identity when no indexed account exists', () => {
    expect(
      getPrimeInfiniAccountSelectionIdentity({
        othersWalletAccountId: 'others-1',
      }),
    ).toBe('others:others-1');
  });

  it('returns an empty identity when no account is selected', () => {
    expect(getPrimeInfiniAccountSelectionIdentity({})).toBe('');
  });
});

describe('getPrimeInfiniConfirmedAccountSelectionOutcome', () => {
  const initialSelectionIdentity = 'indexed:indexed-1:default';

  it('detects a confirmed different account or derive type', () => {
    expect(
      getPrimeInfiniConfirmedAccountSelectionOutcome({
        selectorOpen: true,
        initialSelectionIdentity,
        selectedAccount: {
          indexedAccountId: 'indexed-2',
          deriveType: 'default',
        },
        confirmation: {
          num: 0,
          indexedAccountId: 'indexed-2',
        },
      }),
    ).toBe('changed');
    expect(
      getPrimeInfiniConfirmedAccountSelectionOutcome({
        selectorOpen: true,
        initialSelectionIdentity,
        selectedAccount: {
          indexedAccountId: 'indexed-1',
          deriveType: 'ledger_live',
        },
        confirmation: {
          num: 0,
          indexedAccountId: 'indexed-1',
        },
      }),
    ).toBe('changed');
  });

  it('does not replace after confirming the same account', () => {
    expect(
      getPrimeInfiniConfirmedAccountSelectionOutcome({
        selectorOpen: true,
        initialSelectionIdentity,
        selectedAccount: {
          indexedAccountId: 'indexed-1',
          deriveType: 'default',
        },
        confirmation: {
          num: 0,
          indexedAccountId: 'indexed-1',
        },
      }),
    ).toBe('same');
  });

  it('ignores another selector or a confirmation not reflected in this store', () => {
    expect(
      getPrimeInfiniConfirmedAccountSelectionOutcome({
        selectorOpen: true,
        initialSelectionIdentity,
        selectedAccount: {
          indexedAccountId: 'indexed-1',
          deriveType: 'default',
        },
        confirmation: {
          num: 1,
          indexedAccountId: 'indexed-2',
        },
      }),
    ).toBe('ignore');
    expect(
      getPrimeInfiniConfirmedAccountSelectionOutcome({
        selectorOpen: true,
        initialSelectionIdentity,
        selectedAccount: {
          indexedAccountId: 'indexed-1',
          deriveType: 'default',
        },
        confirmation: {
          num: 0,
          indexedAccountId: 'indexed-2',
        },
      }),
    ).toBe('ignore');
  });

  it('ignores an event after the selector is cancelled or closed', () => {
    expect(
      getPrimeInfiniConfirmedAccountSelectionOutcome({
        selectorOpen: false,
        initialSelectionIdentity,
        selectedAccount: {
          indexedAccountId: 'indexed-2',
          deriveType: 'default',
        },
        confirmation: {
          num: 0,
          indexedAccountId: 'indexed-2',
        },
      }),
    ).toBe('ignore');
  });
});

describe('shouldRebindPrimeInfiniPaymentForAccount', () => {
  const baseParams = {
    accountSyncReady: true,
    isSelectedNetworkReady: true,
    activeAccountId: 'account-2',
    activeAccountAddress: 'payer-address-2',
    payerAccountId: 'account-1',
    payerAddress: 'payer-address-1',
    networkId: asset.networkId,
    phase: 'selecting' as const,
    payment,
    sendStarted: false,
  };

  it('rebinds a restorable payment when the active account changed', () => {
    expect(shouldRebindPrimeInfiniPaymentForAccount(baseParams)).toBe(true);
  });

  it('rebinds a legacy payment without a persisted payer account', () => {
    expect(
      shouldRebindPrimeInfiniPaymentForAccount({
        ...baseParams,
        payerAccountId: undefined,
      }),
    ).toBe(true);
  });

  it('keeps a payment created by the active account', () => {
    expect(
      shouldRebindPrimeInfiniPaymentForAccount({
        ...baseParams,
        payerAccountId: 'account-2',
        payerAddress: 'payer-address-2',
      }),
    ).toBe(false);
  });

  it('keeps an EVM payer account when only address casing changed', () => {
    expect(
      shouldRebindPrimeInfiniPaymentForAccount({
        accountSyncReady: true,
        isSelectedNetworkReady: true,
        activeAccountId: 'account-1',
        activeAccountAddress: '0xabcdef',
        payerAccountId: 'account-1',
        payerAddress: '0xAbCdEf',
        networkId: 'evm--1',
        phase: 'selecting',
        payment,
        sendStarted: false,
      }),
    ).toBe(false);
  });

  it('rebinds a payment when the account address changed', () => {
    expect(
      shouldRebindPrimeInfiniPaymentForAccount({
        ...baseParams,
        payerAccountId: 'account-2',
        payerAddress: 'different-address',
      }),
    ).toBe(true);
  });

  it('waits for account sync and never replaces a payment with progress', () => {
    expect(
      shouldRebindPrimeInfiniPaymentForAccount({
        ...baseParams,
        accountSyncReady: false,
      }),
    ).toBe(false);
    expect(
      shouldRebindPrimeInfiniPaymentForAccount({
        ...baseParams,
        payment: {
          ...payment,
          amountConfirming: '0.01',
        },
      }),
    ).toBe(false);
  });
});
